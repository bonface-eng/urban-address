/**
 * URBAN AUTO EXPRESS System Configuration
 * Centralized settings for the business management platform.
 */
export const SYSTEM_CONFIG = {
  BUSINESS: {
    NAME: 'URBAN AUTO EXPRESS',
    VERSION: 'v2.8.0', 
    ENVIRONMENT: process.env.NODE_ENV || 'development',
    DOMAIN: 'urbanautoexpress.com',
  },
  THEME: {
    PRIMARY_COLOR: '25 100% 50%', 
    SECONDARY_COLOR: '0 0% 100%',
  },
  UI: {
    CURRENCY: 'KES',
    LOCALE: 'en-KE',
  },
  LOCATION: {
    WORKPLACE_LAT: -0.2875484,
    WORKPLACE_LNG: 36.1076805,
    NAME: 'NAKURU HQ',
  }
};

/**
 * MASTER ENVIRONMENT FLOW
 * Explicit mapping of required variables for secure system integration.
 */
export const ENV_CONFIG = {
  SUPABASE: {
    URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Secret (server-side only): never reference from client code.
    SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  STORAGE: {
    PROVIDER: 'CLOUDFLARE_R2',
    ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    PUBLIC_URL: process.env.R2_PUBLIC_URL,
    BUCKET_NAME: process.env.R2_BUCKET_NAME,
    ENDPOINT: process.env.R2_ENDPOINT,
    ACCESS_KEY: process.env.R2_ACCESS_KEY_ID,
    SECRET_KEY: process.env.R2_SECRET_ACCESS_KEY,
  },
  AI: {
    GOOGLE_GENAI_KEY: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
  }
};
