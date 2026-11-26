'use server';
/**
 * @fileOverview JARVIS Inventory Intelligence Flow
 * Predicts stock depletion and generates reorder recommendations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InventoryInputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    stockLevel: z.number(),
    minStock: z.number(),
    velocity: z.number().describe('Units sold per day on average'),
  })),
});

const InventoryOutputSchema = z.object({
  forecasts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    daysRemaining: z.number(),
    risk: z.enum(['STABLE', 'REORDER', 'CRITICAL']),
    recommendedOrder: z.number(),
  })),
  globalPriority: z.string(),
});

export type InventoryOutput = z.infer<typeof InventoryOutputSchema>;

const inventoryPrompt = ai.definePrompt({
  name: 'inventoryIntelligencePrompt',
  input: { schema: InventoryInputSchema },
  output: { schema: InventoryOutputSchema },
  prompt: `Analyze the following inventory telemetry and predict stock-out risks.

Inventory Data:
{{#each items}}
- {{this.name}}: {{this.stockLevel}} units (Sold: {{this.velocity}}/day, Min: {{this.minStock}})
{{/each}}

Calculate:
1. daysRemaining = stockLevel / velocity.
2. If daysRemaining < 2, risk is CRITICAL.
3. If daysRemaining < 7, risk is REORDER.
4. recommendedOrder = velocity * 14 (aim for 2 weeks coverage).

Provide a concise priority summary for the storekeeper.`,
});

export async function analyzeInventoryHealth(input: { items: any[] }): Promise<InventoryOutput> {
  const { output } = await inventoryPrompt(input);
  return output!;
}
