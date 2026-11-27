import * as admin from 'firebase-admin';

/**
 * Shared Firebase Admin SDK Utility
 * Ensures a single, robust instance is used across all server-side routes and actions.
 */
export function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      // Fix for literal newline characters in private keys
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
    } catch (e) {
      console.error('[FIREBASE_ADMIN] Failed to parse Service Account Key:', e);
    }
  }

  // Fallback for environments with standard credentials or when running on Google infra
  return admin.initializeApp({
    projectId: projectId
  });
}

export function getDbAdmin() {
  return admin.firestore(getAdminApp()!);
}
