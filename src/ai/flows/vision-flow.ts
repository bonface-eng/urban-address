
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * JARVIS Vision Analysis Flow
 * Analyzes visual data (screenshots, camera feed, documents).
 */

const VisionInputSchema = z.object({
  photoDataUri: z.string().describe("Base64 data URI of the visual input."),
  query: z.string().describe("User request regarding the visual input."),
});

const VisionOutputSchema = z.object({
  analysis: z.string().describe("Detailed analysis of the visual data."),
  detectedObjects: z.array(z.string()).optional(),
  recommendedAction: z.string().optional(),
});

export type VisionInput = z.infer<typeof VisionInputSchema>;
export type VisionOutput = z.infer<typeof VisionOutputSchema>;

const visionPrompt = ai.definePrompt({
  name: 'visionPrompt',
  input: { schema: VisionInputSchema },
  output: { schema: VisionOutputSchema },
  prompt: `You are JARVIS's vision processing core. 
Analyze the provided visual input and respond to the user's query.
Be precise, technical, and helpful.

Visual Input: {{media url=photoDataUri}}
Query: {{{query}}}`,
});

export async function jarvisVision(input: VisionInput): Promise<VisionOutput> {
  const { output } = await visionPrompt(input);
  return output!;
}
