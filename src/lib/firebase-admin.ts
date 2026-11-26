import * as admin from 'firebase-admin';

/**
 * Shared Firebase Admin SDK Utility.
 * Firebase Admin credentials are server-only and must never be exposed to clients.
 */
export function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccountKey?.trim()) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(serviceAccountKey.trim()) as Record<string, unknown>;
    } catch {
      throw new Error(
        '[FIREBASE_ADMIN] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. Set the complete service-account JSON as a Vercel server-side environment variable.'
      );
    }

    const resolvedProjectId = String(parsed.project_id || parsed.projectId || projectId || '');
    const clientEmail = String(parsed.client_email || parsed.clientEmail || '');
    const rawPrivateKey = parsed.private_key || parsed.privateKey;
    const privateKey = typeof rawPrivateKey === 'string'
      ? rawPrivateKey.replace(/\\n/g, '\n')
      : '';

    if (!resolvedProjectId || !clientEmail || !privateKey) {
      throw new Error(
        '[FIREBASE_ADMIN] Service account JSON is missing project_id, client_email or private_key.'
      );
    }

    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: resolvedProjectId,
        clientEmail,
        privateKey,
      }),
      projectId: resolvedProjectId,
    });
  }

  // Application Default Credentials are supported for local development and
  // Google-managed runtimes. Vercel production must provide the service account.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.K_SERVICE ||
      process.env.NODE_ENV !== 'production') {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }

  throw new Error(
    '[FIREBASE_ADMIN] Missing FIREBASE_SERVICE_ACCOUNT_KEY. Configure the Firebase service-account JSON in Vercel Project Settings > Environment Variables for Production and redeploy.'
  );
}

export function getDbAdmin() {
  return admin.firestore(getAdminApp());
}
