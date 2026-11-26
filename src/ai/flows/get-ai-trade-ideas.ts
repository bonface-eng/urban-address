// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview An AI agent to provide trade ideas.
 *
 * - getAiTradeIdeas - A function that handles the generation of trade ideas.
 * - GetAiTradeIdeasInput - The input type for the getAiTradeIdeas function.
 * - GetAiTradeIdeasOutput - The return type for the getAiTradeIdeas function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetAiTradeIdeasInputSchema = z.object({
  symbol: z.string().describe('The symbol of the currency pair.'),
  history: z.array(z.object({
    open: z.number(),
    close: z.number(),
    high: z.number(),
    low: z.number(),
    volume: z.number(),
    timestamp: z.number()
  })).describe('The historical market data for the currency pair.'),
  strategy: z.string().describe('The trading strategy to base the trade idea on.'),
  timeFrame: z.string().describe('The timeframe for the market data (e.g., 1h, 4h, 1d).'),
});
export type GetAiTradeIdeasInput = z.infer<typeof GetAiTradeIdeasInputSchema>;

const GetAiTradeIdeasOutputSchema = z.object({
  tradeIdea: z.string().describe('A trade idea based on the current market conditions and the selected strategy.'),
});
export type GetAiTradeIdeasOutput = z.infer<typeof GetAiTradeIdeasOutputSchema>;

export async function getAiTradeIdeas(input: GetAiTradeIdeasInput): Promise<GetAiTradeIdeasOutput> {
  return getAiTradeIdeasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getAiTradeIdeasPrompt',
  input: {schema: GetAiTradeIdeasInputSchema},
  output: {schema: GetAiTradeIdeasOutputSchema},
  prompt: `You are an AI technical analyst that provides trade ideas.  You are provided with the symbol, historical market data, strategy, and timeframe.\n\nSymbol: {{{symbol}}}\nHistory: {{#each history}}{{{this.timestamp}}}: O={{{this.open}}}, C={{{this.close}}}, H={{{this.high}}}, L={{{this.low}}}, V={{{this.volume}}}\n{{/each}}\nStrategy: {{{strategy}}}\nTimeframe: {{{timeFrame}}}\n\nBased on this information, provide a trade idea. Be brief and concise. Be very specific with entry price, stop loss, and take profit levels. Do not include any introductory or concluding remarks.`,
});

const getAiTradeIdeasFlow = ai.defineFlow(
  {
    name: 'getAiTradeIdeasFlow',
    inputSchema: GetAiTradeIdeasInputSchema,
    outputSchema: GetAiTradeIdeasOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
