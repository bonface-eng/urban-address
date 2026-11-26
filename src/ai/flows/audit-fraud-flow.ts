
'use server';
/**
 * @fileOverview AI Fraud Detection Agent
 * Analyzes system audit logs for suspicious patterns like multiple voids,
 * high-value refunds, or off-peak terminal activity.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AuditInputSchema = z.object({
  logs: z.array(z.object({
    action: z.string(),
    details: z.string(),
    timestamp: z.number(),
    userId: z.string(),
    severity: z.string()
  })).describe('The recent system audit logs to analyze.'),
});

const AuditOutputSchema = z.object({
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  anomalies: z.array(z.object({
    logId: z.string().optional(),
    reason: z.string(),
    impact: z.string()
  })),
  recommendation: z.string()
});

export type AuditOutput = z.infer<typeof AuditOutputSchema>;

const auditPrompt = ai.definePrompt({
  name: 'auditFraudPrompt',
  input: { schema: AuditInputSchema },
  output: { schema: AuditOutputSchema },
  prompt: `You are the Urban Express Security AI. Analyze the following system audit logs for potential fraud or operational risk.
  
Look for:
1. Multiple "ITEM_VOID" actions by the same user in a short window.
2. Unusual "CASH_DRAWER_OPEN" events without a linked sale.
3. High-value "ORDER_REFUND" events authorized by supervisor PINs.
4. Permissions updates made by non-admin users if visible.

Logs:
{{#each logs}}
- [{{this.severity}}] {{this.action}}: {{this.details}} (User: {{this.userId}})
{{/each}}

Identify any patterns of concern and provide a risk assessment.`,
});

export async function analyzeAuditLogs(input: { logs: any[] }): Promise<AuditOutput> {
  const { output } = await auditPrompt(input);
  return output!;
}
