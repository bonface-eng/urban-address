export function buildEmailConfirmationMessage(subject: string, recipientCount: number) {
  return `Send “${subject}” to ${recipientCount} specified address(es)? This action cannot be recalled.`;
}
