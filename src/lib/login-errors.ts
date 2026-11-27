export type LoginStage = 'security' | 'authentication' | 'profile' | 'audit';

/** Safe, stage-specific messages: never echo backend text or account details. */
export function loginFailure(stage: LoginStage, error: unknown, google = false) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code : '';
  if (stage === 'security') return {
    title: 'Security check unavailable',
    description: 'The login security service could not be reached. Please refresh and retry. Ref: LOGIN_SECURITY_UNAVAILABLE',
  };
  if (stage === 'profile') return {
    title: 'Staff profile unavailable',
    description: code === 'permission-denied' || code === 'firestore/permission-denied'
      ? 'Authentication succeeded, but access to your profile was denied. Contact your administrator. Ref: LOGIN_PROFILE_DENIED'
      : 'Authentication succeeded, but your profile could not be loaded. Please retry or contact your administrator. Ref: LOGIN_PROFILE_UNAVAILABLE',
  };
  if (stage === 'audit') return {
    title: 'Sign-in recording failed',
    description: code === 'permission-denied' || code === 'firestore/permission-denied'
      ? 'Authentication succeeded, but the required sign-in record was denied. Contact your administrator. Ref: LOGIN_AUDIT_DENIED'
      : 'Authentication succeeded, but the required sign-in record could not be saved. Please retry. Ref: LOGIN_AUDIT_UNAVAILABLE',
  };
  if (code === 'auth/network-request-failed') return { title: 'Login Failed', description: 'Could not reach the sign-in service. Check your connection and retry. Ref: LOGIN_AUTH_NETWORK' };
  if (code === 'auth/too-many-requests') return { title: 'Login Failed', description: 'Too many sign-in attempts. Please wait before trying again. Ref: LOGIN_AUTH_RATE_LIMIT' };
  if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') return { title: 'Login Failed', description: 'Sign-in is not configured for this domain or method. Contact your administrator. Ref: LOGIN_AUTH_CONFIGURATION' };
  if (google) return { title: 'Login Failed', description: 'Could not sign in with Google. Ref: LOGIN_GOOGLE_AUTH' };
  if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/user-disabled'].includes(code)) {
    return { title: 'Login Failed', description: 'Invalid email or password, or this account cannot sign in. Use Forgot password or contact your administrator. Ref: LOGIN_AUTH_REJECTED' };
  }
  return { title: 'Login Failed', description: 'The sign-in service could not complete this attempt. Please retry. Ref: LOGIN_AUTH_UNAVAILABLE' };
}
