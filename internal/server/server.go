package server

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/chaoyuepan/mcp-prompt-server-go/internal/prompt"
	"github.com/kataras/golog"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// Server 表示MCP提示词服务器
type Server struct {
	promptsDir string
	mcpServer  *server.MCPServer
	prompts    map[string]*prompt.Prompt
	mu         sync.RWMutex
}

// NewServer 创建一个新的服务器实例
func NewServer(promptsDir string) (*Server, error) {
	s := &Server{
		promptsDir: promptsDir,
		prompts:    make(map[string]*prompt.Prompt),
	}

	// 初始化MCP
	s.mcpServer = server.NewMCPServer(
		"mcp-prompt-server",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	// 加载提示词
	if err := s.loadPrompts(); err != nil {
		return nil, err
	}

	// 注册管理工具
	s.registerManagementTools()

	return s, nil
}

// Start 启动服务器
func (s *Server) Start(addr string) error {
	golog.Println("Starting MCP Prompt Server with", len(s.prompts), "prompts")
	// 使用 server 包的 ServeStdio 函数启动服务器

	if addr == "" {
		return server.ServeStdio(s.mcpServer)
	}

	sseServer := server.NewSSEServer(s.mcpServer)

	return sseServer.Start(addr)
}

// Stop 停止服务器
func (s *Server) Stop() {
	// MCP server 没有显式的停止方法
	golog.Println("Server stopping...")
}

// loadPrompts 加载所有提示词
func (s *Server) loadPrompts() error {
	prompts, err := prompt.LoadFromDirectory(s.promptsDir)
	if err != nil {
		return fmt.Errorf("failed to load prompts: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// 清除现有提示词
	s.prompts = make(map[string]*prompt.Prompt)

	// 注册每个提示词作为MCP工具
	for _, p := range prompts {
		s.prompts[p.Name] = p

		// add prompts as tools
		tool := s.createToolFromPrompt(p)
		s.mcpServer.AddTool(tool, s.createToolHandlerForPrompt(p))

		// add prompts as prompt
		prompt := s.createPromptFromPrompt(p)
		s.mcpServer.AddPrompt(prompt, s.createPromptHandlerForPrompt(p))

		golog.Infof("registered prompt tool: %s", p.Name)
	}

	golog.Infof("loaded %d prompts", len(prompts))
	return nil
}

// createToolFromPrompt 从提示词创建MCP工具
func (s *Server) createToolFromPrompt(p *prompt.Prompt) mcp.Tool {
	// 创建一个基本工具
	tool := mcp.NewTool(p.Name, mcp.WithDescription(p.Description))

	// 为每个参数添加输入schema
	if len(p.Arguments) > 0 {
		properties := make(map[string]any)
		required := []string{}

		for _, arg := range p.Arguments {
			// 假设所有参数都是字符串类型
			properties[arg.Name] = map[string]any{
				"type":        "string",
				"description": arg.Description,
			}

			if arg.Required {
				required = append(required, arg.Name)
			}
		}

		// 直接使用正确的结构
		tool.InputSchema = mcp.ToolInputSchema{
			Type:       "object",
			Properties: properties,
			Required:   required,
		}
	}

	return tool
}

// 从提示词创建MCP提示词
func (s *Server) createPromptFromPrompt(p *prompt.Prompt) mcp.Prompt {
	// 创建一个基本工具
	prompt := mcp.NewPrompt(p.Name, mcp.WithPromptDescription(p.Description))

	// 为每个参数添加输入schema
	if len(p.Arguments) > 0 {
		arguments := make([]mcp.PromptArgument, 0, len(p.Arguments))

		for _, arg := range p.Arguments {
			argument := mcp.PromptArgument{
				Name:        arg.Name,
				Description: arg.Description,
				Required:    arg.Required,
			}

			arguments = append(arguments, argument)
		}

		prompt.Arguments = arguments
	}

	return prompt
}

// createToolHandlerForPrompt 为提示词创建Tool处理函数
func (s *Server) createToolHandlerForPrompt(p *prompt.Prompt) func(context.Context, mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// 获取参数
		arguments := request.GetArguments()

		// 处理参数并替换提示词模板中的占位符
		messages := p.RenderMessages(arguments)

		// 仅处理用户消息作为输出，与原始Node.js实现保持一致
		var promptText string
		for _, msg := range messages {
			if msg.Role == "user" && msg.Content.Type == "text" {
				promptText += msg.Content.Text + "\n\n"
			}
		}

		// 创建响应
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				mcp.TextContent{
					Type: "text",
					Text: strings.TrimSpace(promptText),
				},
			},
		}, nil
	}
}

// createPromptHandlerForPrompt 为提示词创建Prompt处理函数
func (s *Server) createPromptHandlerForPrompt(p *prompt.Prompt) func(context.Context, mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
	return func(ctx context.Context, request mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		// 获取参数
		arguments := request.Params.Arguments

		// 处理参数并替换提示词模板中的占位符
		messages := p.RenderPromptMessages(arguments)

		promptMessages := make([]mcp.PromptMessage, 0, len(messages))
		for _, msg := range messages {
			if msg.Content.Type == "text" {
				promptMessages = append(promptMessages, mcp.PromptMessage{
					Role: mcp.Role(msg.Role),
					Content: mcp.TextContent{
						Type: "text",
						Text: msg.Content.Text,
					},
				})
			} else if strings.Contains(msg.Content.Type, "image") {
				promptMessages = append(promptMessages, mcp.PromptMessage{
					Role: mcp.Role(msg.Role),
					Content: mcp.ImageContent{
						Type:     "image",
						Data:     msg.Content.Text,
						MIMEType: msg.Content.Type,
					},
				})
			}
		}

		return &mcp.GetPromptResult{
			Description: p.Description,
			Messages:    promptMessages,
		}, nil
	}
}

// registerManagementTools 注册管理工具
func (s *Server) registerManagementTools() {
	// 注册reload_prompts工具
	s.mcpServer.AddTool(
		mcp.NewTool("reload_prompts",
			mcp.WithDescription("Hot reload all prompt templates"),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			if err := s.loadPrompts(); err != nil {
				return nil, err
			}

			return &mcp.CallToolResult{
				Content: []mcp.Content{
					mcp.TextContent{
						Type: "text",
						Text: fmt.Sprintf("Successfully reloaded %d prompts", len(s.prompts)),
					},
				},
			}, nil
		},
	)

	// 注册get_prompt_names工具
	s.mcpServer.AddTool(
		mcp.NewTool("get_prompt_names",
			mcp.WithDescription("List all available prompt names"),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			s.mu.RLock()
			defer s.mu.RUnlock()

			var names string
			for name := range s.prompts {
				names += "- " + name + "\n"
			}

			return &mcp.CallToolResult{
				Content: []mcp.Content{
					mcp.TextContent{
						Type: "text",
						Text: fmt.Sprintf("Available prompts (%d):\n%s", len(s.prompts), names),
					},
				},
			}, nil
		},
	)
}
