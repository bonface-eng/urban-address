
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export async function jarvisIntelligence(input: { query: string }) {
  const { text } = await ai.generate(input.query);
  return { response: text };
}
