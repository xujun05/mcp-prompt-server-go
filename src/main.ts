// src/main.ts
import { PromptServer } from './server/server';
import pino from 'pino';

const logger = pino({ level: 'info' });

function parseArgs(): { addr?: string; stdio: boolean } {
  const args = process.argv.slice(2);
  const result: { addr?: string; stdio: boolean } = { stdio: false };

  const stdioIndex = args.indexOf('--stdio');
  if (stdioIndex !== -1) {
    result.stdio = true;
    args.splice(stdioIndex, 1); // Remove --stdio from args
  }

  const addrIndex = args.indexOf('--addr');
  if (addrIndex !== -1 && args.length > addrIndex + 1) {
    result.addr = args[addrIndex + 1];
    // Ensure --stdio is not also set if --addr is provided
    if (result.stdio) {
        logger.warn("Both --stdio and --addr provided. --addr will be used.");
        result.stdio = false;
    }
  } else if (!result.stdio) { // Default to :8888 if not stdio and no addr provided
    result.addr = ':8888';
  }
  // If stdio is true, addr will be undefined, which is desired.
  // If stdio is false and no addr, it defaults to ':8888'.
  // If stdio is false and addr is specified, it uses that addr.
  return result;
}

async function main() {
  logger.info('Starting MCP Prompt Server (TypeScript Version)...');
  const { addr, stdio } = parseArgs();

  const promptsDir = './prompts'; // Adjusted path to be relative to project root
  const generateRuleTxtPath = './generate_rule.txt'; // Relative to project root
  
  let serverInstance: PromptServer | null = null;

  try {
    serverInstance = new PromptServer(promptsDir, generateRuleTxtPath);
    
    // Graceful shutdown setup
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.once(signal, async () => { // Use process.once
        logger.info(`\nReceived ${signal}. Shutting down server...`);
        if (serverInstance) {
          try {
            // serverInstance.stop() is synchronous in the current implementation
            // If it becomes async, add await here.
            serverInstance.stop(); 
            logger.info('Server stopped successfully.');
          } catch (err) {
            logger.error('Error during server stop:', err);
            process.exit(1); // Exit with error if stop fails
          }
        }
        process.exit(0);
      });
    });

    // Start the server
    if (stdio) {
      logger.info('Server configured to use stdio transport.');
      // Ensure server.start() for stdio is blocking or handles its lifecycle appropriately.
      // The SDK's serveStdio is expected to be blocking.
      await serverInstance.start(); 
      logger.info('Stdio transport finished.');
    } else if (addr) {
      logger.info(`Server configured to listen on address: ${addr}`);
      // Ensure server.start(addr) for network is blocking or handles its lifecycle.
      // The SDK's SSEServer.listen (called by server.start) is expected to be blocking.
      await serverInstance.start(addr); 
      logger.info('Server has shut down.'); // Logged when/if start() resolves (e.g. server is stopped)
    } else {
      // This case should ideally not be reached if parseArgs has a default for non-stdio.
      // If parseArgs ensures 'addr' is set when 'stdio' is false, this path is less likely.
      logger.warn('No specific transport (stdio/addr). Attempting default server start (likely stdio or SDK default).');
      await serverInstance.start(); // Defaults to stdio if addr is undefined in server.start()
      logger.info('Server (default start) has shut down.');
    }

  } catch (error) {
    logger.fatal('Failed to start or run the server:', error);
    if (serverInstance && typeof (serverInstance as any).stop === 'function') {
      try {
        // serverInstance.stop(); // Call stop if it's synchronous
      } catch (stopErr) {
        logger.error('Error trying to stop server after startup failure:', stopErr);
      }
    }
    process.exit(1);
  }
}

main().catch(error => {
  // This catch is for errors outside the main try-catch, e.g., in initial logger setup
  // or if main itself throws an unhandled synchronous error before the try-catch block.
  // As main is async, most errors within it should be caught by its own try-catch.
  logger.fatal('Critical unhandled error in main execution:', error);
  process.exit(1);
});
