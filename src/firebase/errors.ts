'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/** Keeps detailed context for internal diagnostics, but not in Error.message. */
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    super('Urban Auto Express could not authorize this request.');
    this.name = 'ServiceAccessError';
    this.context = context;
  }
}
