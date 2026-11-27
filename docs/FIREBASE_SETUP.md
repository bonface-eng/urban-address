
# Firebase Configuration & Security Setup

The application is configured to use the following production credentials.

## 1. Required Authorized Domains
You MUST add the following exactly as shown to **Firebase Console > Authentication > Settings > Authorized Domains**:

- `localhost`
- `urbanautoexpress.com`
- `www.urbanautoexpress.com`
- `studio.firebase.google.com` (CRITICAL for Studio Previews)
- `studio-4371382043-96293.firebaseapp.com`
- `studio-4371382043-96293.web.app`

## 2. Active Environment Configuration
Your `.env` file should contain these verified values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCBG-imyZ2UVnU2oDX-S2j03gcFrmjwO70
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-4371382043-96293.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-4371382043-96293
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=studio-4371382043-96293.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=461148427857
NEXT_PUBLIC_FIREBASE_APP_ID=1:461148427857:web:c1b25e9a782e0920300a70
```

## 3. Troubleshooting "API Key Not Valid"
1. Verify that the `apiKey` in `.env` matches the one in your Firebase Project Settings.
2. **RESTART your development server** (Next.js does not hot-reload .env changes).
3. Ensure the Web App in Firebase Console is enabled.

---
*URBAN EXPRESS Engineering | System Infrastructure*
