'use server';
/**
 * @fileOverview JARVIS Business Intelligence Flow
 * Analyzes sales, profits, and operational performance using natural language.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BIInputSchema = z.object({
  query: z.string().describe('The business question or command from the owner.'),
  context: z.object({
    dailySales: z.number().optional(),
    topProducts: z.array(z.any()).optional(),
    pendingBills: z.number().optional(),
    inventoryAlerts: z.number().optional(),
  }).optional(),
});

const BIOutputSchema = z.object({
  summary: z.string().describe('A concise professional summary of the requested data.'),
  insights: z.array(z.string()).describe('Key patterns or alerts identified by the AI.'),
  recommendation: z.string().describe('Suggested operational action.'),
  dataPoints: z.record(z.any()).optional().describe('Structured data results for UI rendering.'),
});

export type BIInput = z.infer<typeof BIInputSchema>;
export type BIOutput = z.infer<typeof BIOutputSchema>;

const biPrompt = ai.definePrompt({
  name: 'businessIntelligencePrompt',
  input: { schema: BIInputSchema },
  output: { schema: BIOutputSchema },
  prompt: `You are JARVIS, the Urban Express Business Copilot. 
Your goal is to provide high-fidelity financial and operational intelligence to the business owner.

Current Context:
- Daily Sales Volume: KES {{context.dailySales}}
- Pending Backlog: KES {{context.pendingBills}}
- Low Stock Alerts: {{context.inventoryAlerts}}
- Top Movers: {{#each context.topProducts}}{{this.name}} ({{this.count}}){{/each}}

Owner Inquiry: {{{query}}}

Guidelines:
1. Be precise and data-driven.
2. Use professional automotive/hospitality terminology.
3. If sales are down or stock is low, flag it as a priority.
4. Convert the inquiry into actionable insights.

Response must follow the structured schema provided.`,
});

export async function jarvisConsult(input: BIInput): Promise<BIOutput> {
  const { output } = await biPrompt(input);
  return output!;
}
