// src/prompt/loader.ts
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { Prompt } from './models';
import pino from 'pino';

// Basic logger setup (can be refined later)
const logger = pino({ level: 'info' });

export async function loadFromFile(filePath: string): Promise<Prompt | null> {
  logger.debug(`Attempting to load prompt from: ${filePath}`);
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    let parsedContent: any;

    if (filePath.endsWith('.json')) {
      parsedContent = JSON.parse(fileContent);
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      parsedContent = yaml.parse(fileContent);
    } else {
      logger.warn(`Skipping unsupported file type: ${filePath}`);
      return null;
    }

    if (!parsedContent || !parsedContent.name) {
      logger.error(`Prompt name is missing in file: ${filePath}`);
      return null;
    }
    
    // Add more validation if necessary based on the Prompt interface

    return parsedContent as Prompt;
  } catch (error) {
    logger.error(`Error loading or parsing prompt from ${filePath}:`, error);
    return null;
  }
}

export async function loadFromSubdirectories(rootDir: string): Promise<Prompt[]> {
  logger.info(`Starting to load prompts from subdirectories in: ${rootDir}`);
  const allPrompts: Prompt[] = [];
  const resolvedRootDir = path.resolve(rootDir);

  async function walk(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name.endsWith('.json'))) {
          const prompt = await loadFromFile(fullPath);
          if (prompt) {
            allPrompts.push(prompt);
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${currentDir}:`, error);
    }
  }

  await walk(resolvedRootDir);
  logger.info(`Finished loading prompts. Found ${allPrompts.length} prompts in ${resolvedRootDir} and its subdirectories.`);
  return allPrompts;
}
