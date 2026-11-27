
/**
 * FIREBASE CONFIGURATION
 * 
 * IMPORTANT: Values are populated from the .env file.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Defensive check to help identify missing environment variables in development
if (process.env.NODE_ENV === 'development') {
  Object.entries(config).forEach(([key, value]) => {
    if (!value || value.includes('EXAMPLE')) {
      console.warn(`[FIREBASE CONFIG] Warning: ${key} is missing or using a placeholder value in .env`);
    }
  });
}

export const firebaseConfig = config;
