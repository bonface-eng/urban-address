# Temporary login CAPTCHA switch

The site owner requested temporarily allowing normal login without reCAPTCHA.
`LOGIN_RECAPTCHA_ENABLED=false` (server-only, exact lowercase value) skips only
the login CAPTCHA check. Unset, true, or any other value keeps CAPTCHA enabled.
The server rechecks the flag on every verification, not a client-supplied setting.

Password and Google authentication, profile roles, Firestore permissions,
application route gates, signup/contact CAPTCHA checks, and Vercel Firewall are
unchanged. Existing reCAPTCHA keys are retained. The login password is no longer
copied into Firestore `masterKey`; no historical database records are modified.

Disabling CAPTCHA reduces protection against credential stuffing and automated
login attempts. Treat this as temporary. Restore a working reCAPTCHA integration
and set the flag to true (or remove it) in Preview and Production, then redeploy.
The Enterprise integration repair is tracked in PR #161; it requires Google Cloud
configuration before it can be safely published.

This patch targets the restored release branch rather than main, preserving the
November 19 application plus the published search-discovery fixes. A build and
mocked login tests do not prove a real account's credentials or permissions.
