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

