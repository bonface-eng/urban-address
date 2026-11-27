'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/** Raised when Row Level Security rejects a query. Detailed context stays out of Error.message. */
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    super('Urban Auto Express could not authorize this request.');
    this.name = 'ServiceAccessError';
    this.context = context;
  }
}
