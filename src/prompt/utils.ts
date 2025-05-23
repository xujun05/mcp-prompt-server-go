// src/prompt/utils.ts
import { Message as PromptFileMessage } from './models'; // Assuming models.ts is in the same directory or adjust path
import pino from 'pino'; // Optional: if specific logging is needed here

const logger = pino({ level: 'debug' }); // Or use a shared logger

export function renderMessages(
  originalMessages: Readonly<PromptFileMessage[]>,
  args: Record<string, any>
): PromptFileMessage[] {
  if (!originalMessages) {
    logger.warn('renderMessages called with undefined or null originalMessages. Returning empty array.');
    return [];
  }

  logger.debug({ count: originalMessages.length, args }, 'renderMessages called');

  return originalMessages.map((msg, index) => {
    // Deep clone the message content to avoid modifying the original
    // Ensure content and content.text exist
    if (!msg.content) {
        logger.warn({ msgIndex: index, msgRole: msg.role }, 'Message content is undefined. Skipping rendering for this message.');
        return { ...msg }; // Return a copy of the original message
    }

    const renderedContent = { ...msg.content };

    // Replace placeholders in the text
    if (renderedContent.text && typeof renderedContent.text === 'string') {
      let tempText = renderedContent.text;
      for (const key in args) {
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          const placeholder = `{{${key}}}`;
          // Ensure value is a string for replacement and handle undefined/null args gracefully
          const value = args[key] === undefined || args[key] === null ? '' : String(args[key]);
          // Use a global regular expression for replacement
          // Escape special characters in placeholder for RegExp
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          tempText = tempText.replace(new RegExp(escapedPlaceholder, 'g'), value);
        }
      }
      renderedContent.text = tempText;
      logger.trace({ msgIndex: index, originalText: msg.content.text, renderedText: tempText }, 'Message text rendered');
    } else {
      logger.trace({ msgIndex: index, contentType: renderedContent.type }, 'Message content is not text or text is undefined. Skipping text rendering.');
    }

    // Return a new message object with the rendered content
    return {
      ...msg, // Copy other message properties like 'role'
      content: renderedContent,
    };
  });
}
