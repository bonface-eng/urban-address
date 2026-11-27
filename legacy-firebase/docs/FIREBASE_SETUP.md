
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
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

## 3. Troubleshooting "API Key Not Valid"
1. Verify that the `apiKey` in `.env` matches the one in your Firebase Project Settings.
2. **RESTART your development server** (Next.js does not hot-reload .env changes).
3. Ensure the Web App in Firebase Console is enabled.

---
*URBAN EXPRESS Engineering | System Infrastructure*
