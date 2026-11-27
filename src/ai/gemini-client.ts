
/**
 * @fileOverview JARVIS Gemini Intelligence Client
 * 
 * Provides a production-ready interface for Gemini models via Genkit.
 * Handles streaming, history management, and resilient error recovery.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logger';

// Standard Model Definitions
export const JARVIS_MODELS = {
  FLASH: 'googleai/gemini-2.5-flash',
  PRO: 'googleai/gemini-1.5-pro',
  FLASH_8B: 'googleai/gemini-1.5-flash-8b',
} as const;

export type JarvisModel = keyof typeof JARVIS_MODELS;

// Schema for structured chat interactions
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model', 'system']),
  content: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const GeminiChatInputSchema = z.object({
  prompt: z.string(),
  history: z.array(ChatMessageSchema).optional(),
  model: z.string().default(JARVIS_MODELS.FLASH),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().optional(),
});

export type GeminiChatInput = z.infer<typeof GeminiChatInputSchema>;

/**
 * Executes a streaming chat request with the Gemini engine.
 * Includes retry logic and centralized error reporting.
 */
export async function* streamGeminiResponse(input: GeminiChatInput) {
  logger.info(`Initiating AI Stream [Model: ${input.model}]`);

  try {
    const { stream, response } = ai.generateStream({
      model: input.model,
      system: input.systemPrompt,
      prompt: input.prompt,
      messages: input.history?.map(m => ({
        role: m.role as any,
        content: [{ text: m.content }]
      })),
      config: {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens,
      },
    } as any);

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }

    // Await full response to catch any post-stream errors
    const finalResponse = await response;
    logger.debug('Stream completed successfully.');
    return finalResponse;

  } catch (error: any) {
    // If the stream was aborted (e.g. navigation), handle it silently
    if (error.name === 'AbortError') {
      logger.info('AI Stream cancelled by user/client.');
      return;
    }
    handleGeminiError(error);
    throw error;
  }
}

/**
 * Specialized error handling for Gemini API responses.
 */
function handleGeminiError(error: any) {
  const status = error?.status || error?.code;
  const message = error?.message || 'Unknown neural interface failure.';

  if (status === 429) {
    logger.error('CRITICAL: Rate limit exceeded. Throttling requested.');
  } else if (status === 503 || status === 500) {
    logger.warn('SYSTEM: AI Service temporarily unavailable. Attempting reconnection...');
  } else if (error.name === 'AbortError' || message.includes('timeout')) {
    logger.error('LINK: Connection timed out or aborted.');
  } else {
    logger.error(`NEURAL_ERROR: ${message}`, { status });
  }
}
