// src/server/server.ts
import path from 'path';
import fs from 'fs/promises';
import yaml from 'yaml';
import pino from 'pino';
import { Prompt as PromptFile, Argument as PromptFileArgument, Message as PromptFileMessage, Content as PromptFileContent } from '../prompt/models';
import { loadFromSubdirectories, loadFromFile as loadPromptFile } from '../prompt/loader'; // Renamed to avoid conflict
import { renderMessages } from '../prompt/utils';
import {
  MCPServer,
  BaseTool,
  ToolInputSchema,
  CallToolRequest,
  CallToolResult,
  TextContent,
  BasePrompt,
  PromptArgument as SDKPromptArgument,
  PromptMessage as SDKPromptMessage,
  GetPromptRequest,
  GetPromptResult,
  Role as SDKRole,
  ImageContent,
  serveStdio,
  SSEServer,
  // Assuming these types might be needed for tool/prompt registration and content handling
  ToolHandler,
  PromptHandler,
  Content as SDKContent,
  Context, // General context object often passed to handlers
} from '@modelcontextprotocol/sdk';

const logger = pino({ level: 'info' });

export class PromptServer {
  private promptsDir: string;
  private mcpServer: MCPServer;
  private prompts: Map<string, PromptFile> = new Map();
  private generateRuleTxtPath: string = 'generate_rule.txt'; // Path to the rule file

  constructor(promptsDir: string, generateRuleTxtPath: string = 'generate_rule.txt') {
    this.promptsDir = path.resolve(promptsDir);
    this.generateRuleTxtPath = generateRuleTxtPath;

    // TODO: Replace with actual SDK instantiation and options.
    // This is a placeholder based on the Go example and common patterns.
    // The exact structure of MCPServer constructor and its options needs to be verified
    // against the @modelcontextprotocol/sdk documentation.
    this.mcpServer = new MCPServer({
      name: 'mcp-prompt-server-ts',
      version: '1.0.0',
      // Assuming capabilities are set like this. This might be part of registration
      // or individual tool/prompt definitions in some SDKs.
      capabilities: {
        tool_calling: true, // or similar field
        prompt_serving: true // or similar field
      },
      logger: logger, // Pass the logger to the SDK server if supported
    });

    this.loadPromptsAndRegisterTools().catch(err => {
      logger.error('Failed to load prompts during initial construction:', err);
    });
    this.registerManagementTools();
  }

  // --- Prompt and Tool Loading ---

  async loadPromptsAndRegisterTools(): Promise<void> {
    logger.info(`Loading prompts from directory: ${this.promptsDir}`);
    const loadedPrompts = await loadFromSubdirectories(this.promptsDir);

    // Assuming the SDK requires clearing before re-registering.
    // This might not be necessary or might be handled differently.
    // e.g., this.mcpServer.clearTools(); this.mcpServer.clearPrompts();
    this.prompts.clear();
    // If the SDK has a way to list or remove specific tools/prompts, that would be more robust.
    // For now, assuming a full clear is either not needed or handled by re-adding with the same name.

    for (const promptFile of loadedPrompts) {
      if (this.prompts.has(promptFile.name)) {
        logger.warn(`Prompt with name "${promptFile.name}" already loaded. Overwriting.`);
      }
      this.prompts.set(promptFile.name, promptFile);

      // Register as a Tool
      try {
        const tool = this.createToolFromPrompt(promptFile);
        const toolHandler = this.createToolHandlerForPrompt(promptFile);
        // Assuming addTool takes the tool definition and its handler.
        // The exact method (e.g., addTool, registerTool) depends on the SDK.
        this.mcpServer.addTool(tool, toolHandler as ToolHandler<Context, any, any>); // Cast handler if necessary
        logger.info(`Registered tool: ${tool.name}`);
      } catch (error) {
        logger.error(`Failed to create or register tool for prompt "${promptFile.name}":`, error);
      }

      // Register as an MCP Prompt
      try {
        const mcpPrompt = this.createMCPPromptFromPrompt(promptFile);
        const mcpPromptHandler = this.createMCPPromptHandlerForPrompt(promptFile);
        // Assuming addPrompt takes the prompt definition and its handler.
        this.mcpServer.addPrompt(mcpPrompt, mcpPromptHandler as PromptHandler<Context, any, any>); // Cast handler if necessary
        logger.info(`Registered MCP prompt: ${mcpPrompt.name}`);
      } catch (error) {
        logger.error(`Failed to create or register MCP prompt "${promptFile.name}":`, error);
      }
    }
    logger.info(`Successfully loaded and registered ${this.prompts.size} prompts and their corresponding tools.`);
  }

  private createToolFromPrompt(prompt: PromptFile): BaseTool<ToolInputSchema<any>, any> {
    const properties: Record<string, any> = {};
    const requiredArgs: string[] = [];

    for (const arg of prompt.arguments) {
      properties[arg.name] = {
        type: arg.type === 'number' ? 'number' : arg.type === 'boolean' ? 'boolean' : 'string', // Default to string
        description: arg.description,
      };
      if (arg.required) {
        requiredArgs.push(arg.name);
      }
    }

    const inputSchema: ToolInputSchema<any> = {
      type: 'object',
      properties,
      required: requiredArgs,
    };
    
    // Assuming BaseTool or a similar constructor/factory method exists.
    // The exact parameters and structure depend on the SDK.
    return new BaseTool({ // This is a guess for the SDK API
        name: prompt.name,
        description: prompt.description,
        inputSchema: inputSchema,
    });
  }

  private createToolHandlerForPrompt(prompt: PromptFile): ToolHandler<Context, CallToolRequest<any>, CallToolResult<any>> {
    return async (ctx: Context, request: CallToolRequest<any>): Promise<CallToolResult<any>> => {
      logger.info({ toolName: prompt.name, requestId: request.id }, 'Tool handler invoked');
      try {
        // Assuming getArguments() returns a simple Record<string, any>
        // The actual method might be request.input or request.arguments
        const args = request.arguments || {};
        logger.debug({ toolName: prompt.name, args }, 'Received arguments for tool');

        const rendered = renderMessages(prompt.messages, args);
        
        // Concatenate text from "user" messages as per original Go logic (simplified)
        // This part might need adjustment based on how the SDK expects results,
        // especially if multiple content types or roles are involved in the "result".
        // For a tool, typically a single output is expected.
        const userMessagesText = rendered
          .filter(msg => msg.role.toLowerCase() === 'user')
          .map(msg => msg.content.text)
          .join('\n');

        // Assuming the SDK expects content in a specific format for CallToolResult.
        // This could be a TextContent object or a more generic SDKContent array.
        const resultContents: SDKContent[] = [{ type: 'text', text: userMessagesText } as TextContent];

        return {
          id: request.id, // Echo back the request ID
          // toolName: prompt.name, // This might be part of the result or implicit
          contents: resultContents,
          // error: undefined, // Explicitly no error
        } as CallToolResult<any>; // Cast if SDK requires a more specific type
      } catch (error: any) {
        logger.error({ toolName: prompt.name, error: error.message }, 'Error in tool handler');
        return {
          id: request.id,
          // toolName: prompt.name,
          contents: [], // No content on error
          error: { // Assuming an error structure
            code: 'tool_execution_error', // Or some other error code
            message: error.message,
          },
        } as CallToolResult<any>;
      }
    };
  }

  private createMCPPromptFromPrompt(promptFile: PromptFile): BasePrompt<any,any> {
    const sdkArguments: SDKPromptArgument[] = promptFile.arguments.map(arg => ({
      name: arg.name,
      description: arg.description,
      // Assuming SDKPromptArgument also has a 'type' and 'required' field.
      // The SDK might handle type differently (e.g., using schema).
      type: arg.type === 'number' ? 'number' : arg.type === 'boolean' ? 'boolean' : 'string',
      required: arg.required,
    }));

    // Assuming BasePrompt or a similar constructor/factory method exists.
    return new BasePrompt({ // This is a guess for the SDK API
        name: promptFile.name,
        description: promptFile.description,
        arguments: sdkArguments,
        // messages: promptFile.messages.map(this.mapPromptFileMessageToSDKMessage) // Messages are usually dynamic
    });
  }
  
  // Helper to map PromptFileContent to SDKContent (handles text/image)
  private mapPromptFileContentToSDKContent(fileContent: PromptFileContent): SDKContent {
    if (fileContent.type.startsWith('image/')) {
      return {
        type: fileContent.type as SDKContent['type'], // e.g. "image/jpeg"
        source: {
          type: 'base64', // Assuming base64 for images, SDK might support URLs etc.
          media_type: fileContent.type,
          data: fileContent.text, // Assuming text field holds base64 data for images
        }
      } as ImageContent; // Cast to ImageContent or the SDK's image type
    }
    // Default to TextContent
    return { type: 'text', text: fileContent.text } as TextContent;
  }


  private mapPromptFileMessageToSDKMessage(fileMsg: PromptFileMessage): SDKPromptMessage {
    let role: SDKRole;
    switch (fileMsg.role.toLowerCase()) {
      case 'user':
        role = SDKRole.USER; // Assuming SDKRole.USER, SDKRole.ASSISTANT, etc.
        break;
      case 'assistant':
        role = SDKRole.ASSISTANT;
        break;
      case 'system':
        role = SDKRole.SYSTEM;
        break;
      default:
        logger.warn(`Unknown role "${fileMsg.role}", defaulting to USER.`);
        role = SDKRole.USER; // Or throw an error
    }
  
    return {
      role: role,
      // Assuming SDKPromptMessage has a 'content' field that can be an array of SDKContent
      // or a single SDKContent object. The Go code implies a single content item per message.
      content: [this.mapPromptFileContentToSDKContent(fileMsg.content)],
    };
  }


  private createMCPPromptHandlerForPrompt(promptFile: PromptFile): PromptHandler<Context, GetPromptRequest<any>, GetPromptResult<any>> {
    return async (ctx: Context, request: GetPromptRequest<any>): Promise<GetPromptResult<any>> => {
      logger.info({ promptName: promptFile.name, requestId: request.id }, 'MCP prompt handler invoked');
      try {
        // Assuming arguments are in request.arguments or request.params.arguments
        const args = request.arguments || {};
        logger.debug({ promptName: promptFile.name, args }, 'Received arguments for MCP prompt');

        const renderedFileMessages = renderMessages(promptFile.messages, args);

        const sdkMessages: SDKPromptMessage[] = renderedFileMessages.map(
          (msg) => this.mapPromptFileMessageToSDKMessage(msg)
        );

        return {
          id: request.id, // Echo back request ID
          // promptName: promptFile.name, // Might be part of the result or implicit
          description: promptFile.description, // Description might be part of the result
          messages: sdkMessages,
          // error: undefined,
        } as GetPromptResult<any>; // Cast if necessary
      } catch (error: any) {
        logger.error({ promptName: promptFile.name, error: error.message }, 'Error in MCP prompt handler');
        return {
          id: request.id,
          // promptName: promptFile.name,
          description: promptFile.description, // Still return description on error
          messages: [], // No messages on error
          error: { // Assuming an error structure
            code: 'prompt_rendering_error',
            message: error.message,
          },
        } as GetPromptResult<any>;
      }
    };
  }


  // --- Management Tools ---

  private registerManagementTools(): void {
    // 1. reload_prompts
    const reloadTool = new BaseTool<any, any>({
        name: 'reload_prompts',
        description: 'Reloads all prompts from the configured directory and re-registers them with the server.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    });
    const reloadHandler: ToolHandler<Context, CallToolRequest<any>, CallToolResult<any>> = async (ctx, request) => {
      logger.info('Executing reload_prompts tool');
      try {
        await this.loadPromptsAndRegisterTools();
        return {
          id: request.id,
          contents: [{ type: 'text', text: `Successfully reloaded ${this.prompts.size} prompts.` } as TextContent],
        };
      } catch (error: any) {
        logger.error('Error reloading prompts:', error);
        return {
          id: request.id,
          contents: [],
          error: { code: 'reload_failed', message: error.message },
        };
      }
    };
    this.mcpServer.addTool(reloadTool, reloadHandler);

    // 2. add_prompt
    const addPromptTool = new BaseTool<any, any>({
      name: 'add_prompt',
      description: 'Adds a new prompt to the server from YAML content.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'The category (subdirectory) for the new prompt.' },
          filename: { type: 'string', description: 'The filename for the new prompt (e.g., my_new_prompt.yaml).' },
          yaml_content: { type: 'string', description: 'The YAML content of the prompt.' },
        },
        required: ['category', 'filename', 'yaml_content'],
      },
    });
    const addPromptHandler: ToolHandler<Context, CallToolRequest<any>, CallToolResult<any>> = async (ctx, request) => {
      const args = request.arguments || {};
      const { category, filename, yaml_content } = args;
      logger.info(`Executing add_prompt tool for ${category}/${filename}`);

      if (!category || !filename || !yaml_content) {
        return { id: request.id, contents:[], error: { code: 'missing_arguments', message: 'Missing category, filename, or yaml_content.' }};
      }
      if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) {
        return { id: request.id, contents:[], error: { code: 'invalid_filename', message: 'Filename must end with .yaml or .yml.' }};
      }

      const promptFilePath = path.join(this.promptsDir, category, filename);
      try {
        const parsedPrompt: PromptFile = yaml.parse(yaml_content);
        if (!parsedPrompt.name) {
          return { id: request.id, contents:[], error: { code: 'invalid_yaml', message: 'Prompt name is missing in YAML content.' }};
        }
        // Optional: Validate parsedPrompt.name against filename (e.g., base name of filename)
        // const baseFilename = path.basename(filename, path.extname(filename));
        // if (parsedPrompt.name !== baseFilename) { ... }

        await fs.mkdir(path.dirname(promptFilePath), { recursive: true });
        await fs.writeFile(promptFilePath, yaml_content, 'utf-8');
        logger.info(`Prompt file written to: ${promptFilePath}`);

        try {
          await this.loadPromptsAndRegisterTools();
          return { id: request.id, contents: [{ type: 'text', text: `Prompt ${parsedPrompt.name} added and all prompts reloaded. Total: ${this.prompts.size}` } as TextContent]};
        } catch (reloadError: any) {
          logger.error(`Reload failed after adding prompt ${promptFilePath}. Attempting to delete the new file.`, reloadError);
          try {
            await fs.unlink(promptFilePath); // Attempt to cleanup
          } catch (deleteError: any) {
            logger.error(`Failed to delete partially added prompt file ${promptFilePath}. Manual cleanup may be required.`, deleteError);
          }
          return { id: request.id, contents:[], error: { code: 'reload_failed_after_add', message: `Prompt file written, but reload failed: ${reloadError.message}. Attempted cleanup.` }};
        }
      } catch (error: any) {
        logger.error(`Error adding prompt ${category}/${filename}:`, error);
        return { id: request.id, contents:[], error: { code: 'add_prompt_failed', message: error.message }};
      }
    };
    this.mcpServer.addTool(addPromptTool, addPromptHandler);

    // 3. get_prompt_generate_rule
    const getRuleTool = new BaseTool<any, any>({
        name: 'get_prompt_generate_rule',
        description: 'Gets the content of the prompt generation rule file.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    });
    const getRuleHandler: ToolHandler<Context, CallToolRequest<any>, CallToolResult<any>> = async (ctx, request) => {
      logger.info('Executing get_prompt_generate_rule tool');
      try {
        const ruleContent = await fs.readFile(this.generateRuleTxtPath, 'utf-8');
        return { id: request.id, contents: [{ type: 'text', text: ruleContent } as TextContent]};
      } catch (error: any) {
        logger.error('Error reading prompt generate rule file:', error);
        return { id: request.id, contents:[], error: { code: 'file_read_error', message: `Failed to read ${this.generateRuleTxtPath}: ${error.message}` }};
      }
    };
    this.mcpServer.addTool(getRuleTool, getRuleHandler);

    // 4. get_prompt_names
    const getNamesTool = new BaseTool<any, any>({
        name: 'get_prompt_names',
        description: 'Gets a list of all currently loaded prompt names.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    });
    const getNamesHandler: ToolHandler<Context, CallToolRequest<any>, CallToolResult<any>> = async (ctx, request) => {
      logger.info('Executing get_prompt_names tool');
      const names = Array.from(this.prompts.keys());
      return {
        id: request.id,
        contents: [{ type: 'text', text: JSON.stringify(names) } as TextContent], // Return as JSON string array
      };
    };
    this.mcpServer.addTool(getNamesTool, getNamesHandler);

    logger.info('Registered management tools: reload_prompts, add_prompt, get_prompt_generate_rule, get_prompt_names.');
  }

  // --- Server Lifecycle ---

  public async start(addr?: string): Promise<void> {
    logger.info(`Starting MCP Prompt Server (TypeScript)...`);
    if (!addr || addr.trim() === '') {
      logger.info('No address provided, serving over stdio.');
      // Assuming serveStdio takes the MCPServer instance and starts listening.
      // The actual signature might vary (e.g., it might return a promise or be synchronous).
      await serveStdio(this.mcpServer); // This might block, or need await if it returns a Promise
      logger.info('MCP Server is listening on stdio.');
    } else {
      logger.info(`Serving over HTTP/SSE on address: ${addr}`);
      // Assuming SSEServer is instantiated with the MCPServer instance.
      const sseServer = new SSEServer(this.mcpServer, { logger: logger }); // Pass logger if supported
      // Assuming sseServer.start() starts the HTTP/SSE server.
      // This might also block or return a promise.
      await sseServer.listen(addr); // Or .start(addr)
      logger.info(`MCP Server is listening for SSE connections on ${addr}`);
    }
  }

  public stop(): void {
    logger.info('Stopping MCP Prompt Server (TypeScript)...');
    // Assuming the SDK server instances have a stop or close method.
    // This is highly dependent on the SDK's API.
    if (this.mcpServer && typeof (this.mcpServer as any).stop === 'function') {
      (this.mcpServer as any).stop();
    }
    // If SSEServer or stdio server has a separate stop method, call it here.
    // e.g., if sseServer was stored as a member: this.sseServer.stop();
    logger.info('MCP Prompt Server stopped.');
  }
}
