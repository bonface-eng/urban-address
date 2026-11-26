# Branded email templates

The shared server-side templates live in `src/lib/email/templates.ts`:

- `verificationEmail()`
- `passwordResetEmail()`
- `paymentReceiptEmail()`
- `customerNotificationEmail()`

They return `subject`, `html`, and `text` and are delivered through the existing `sendTransactionalEmail()` transport in `src/lib/resend.ts`.

## Brand settings

The shared layout uses the application logo at `https://urbanautoexpress.com/assets/logo.png`, Urban Auto Express orange (`#FF6A00`), charcoal text, a white email card and a light-grey footer. It includes the business phone `+254 785 860 753`, website and Nakuru, Kenya.

## Social profile links

Add the official profile URLs as Vercel Production environment variables. Only valid HTTPS URLs are rendered:

- `EMAIL_SOCIAL_FACEBOOK_URL`
- `EMAIL_SOCIAL_INSTAGRAM_URL`
- `EMAIL_SOCIAL_TIKTOK_URL`
- `EMAIL_SOCIAL_YOUTUBE_URL`

Do not set these to guessed or unofficial profiles. Redeploy after adding or changing them.

## Unsubscribe behavior

The footer links to `/api/email/unsubscribe`. The signed token is generated server-side using the existing `RESEND_API_KEY`; the endpoint shows a confirmation page and only records the preference after the recipient confirms. The preference is stored in Firestore's `email_preferences` collection using a SHA-256 email document ID.

This preference applies to promotional email only. Verification, password-reset, receipt and other essential account/transaction messages remain deliverable.

## Event wiring

- Account verification and password reset use the shared templates in their existing API routes.
- Verified M-Pesa and Airtel Money payment callbacks create a receipt outbox record and send the receipt using the finance sender. Delivery state is recorded in `email_outbox`; failed attempts remain visible for operational retry.
- `customerNotificationEmail()` is available for future customer-notification events.
- The super-admin-only communications centre is available at `/admin/email`. It includes official communications, warning letters, dismissal notices, supplier purchase orders, general messages and marketing broadcasts.
- The send API verifies Firebase ID tokens and the administrator role server-side, sends one message per recipient, records campaign counts and writes an audit log. HR notices and purchase orders require exactly one recipient.
- Marketing campaigns only include customer profiles with `marketingOptIn` or `marketingConsent` set to `true`, and exclude addresses marked unsubscribed. No customers are automatically opted in.

## Legal links and profile

Email footers link to `/legal`, `/terms` and `/privacy`. The app's existing `/assets/logo.png` is used in email templates. The verified general contact address `mail@urbanautoexpress.com` and phone number `+254 785 860 753` are included. The Google Business Profile link is included from the app's existing structured business profile reference. Facebook, Instagram, TikTok and YouTube links remain environment-configured because official URLs were not verified.

Never call the Resend transport from client components. Always send from server-side code and escape customer-provided content (the templates escape dynamic HTML fields).
