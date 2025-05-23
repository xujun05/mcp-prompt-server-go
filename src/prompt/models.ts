// src/prompt/models.ts

export interface Content {
  type: string; // e.g., "text", "image/jpeg", "image/png"
  text: string; // Text content or image data (e.g., base64 encoded)
}

export interface Message {
  role: string; // e.g., "user", "assistant", "system"
  content: Content;
}

export interface Argument {
  name: string;
  description: string;
  type: string; // e.g., "string", "number", "boolean" - though the Go code implies string for tool inputs
  required: boolean;
}

export interface Prompt {
  name: string;
  description: string;
  arguments: Argument[];
  messages: Message[];

  // Method to be implemented later (Step 5)
  // renderMessages(args: Record<string, any>): Message[];
}
