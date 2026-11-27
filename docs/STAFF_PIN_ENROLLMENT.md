# One-time staff PIN enrollment: November 26 release

After deployment, staff sign in with their existing Firebase password or Google
account, then create and repeat a new **four-digit** terminal PIN. Leading zeroes
are preserved. Legacy profile PINs and browser unlock timestamps do not satisfy
this enrollment. Staff who signed in more than 15 minutes earlier must sign out
and sign in again before enrollment; the setup screen includes that control.

Enrollment is per Firebase UID across terminals and persists after refresh or
future deployments. `staff-pin-2026-11-26-v1` is a fixed migration version, not a
build ID. Existing v1 enrollment cannot be overwritten through this endpoint;
there is no public reset endpoint. No bulk database changes are made at deploy.

## Server boundary

`POST /api/staff-pin` verifies the Firebase ID token with revocation checking,
reads the current staff role, and only operates on that authenticated UID. It
accepts status, enroll, and verify operations. Explicit target UIDs are rejected.
Only known active staff roles qualify. Enrollment requires recent Firebase
account authentication and matching four-digit entries. Every subsequent unlock
checks the server hash, not a profile PIN. Five failed guesses start a ten-minute
account-level cooldown; deleting local storage cannot reset this counter.

Hashes/salts/attempt counters live in `staff_pin_credentials/{uid}`, accessed only
through Firebase Admin. The checked-in Firestore rules have default deny for this
unmatched collection; do not add client read/write access. No PIN/hash is returned
by the API, stored in the browser, or logged. The server uses the existing
`STAFF_PIN_PEPPER` and `FIREBASE_SERVICE_ACCOUNT_KEY` settings, present in Preview
and Production. Do not rotate the pepper casually: existing PIN hashes depend on it.

The legacy profile `pin` field is left untouched for rollback but no longer used.
Recent-operator browser entries are reduced to display identity fields, dropping
legacy PIN/password caches. Switching to a different operator requires their
account sign-in instead of reusing a cached password. The terminal sign-in path
no longer writes passwords into Firestore. Historical credential cleanup is not
part of this release.

Account authentication, Firestore business-data permissions, role routing,
register operations, and the existing temporary login-CAPTCHA setting remain.
This terminal lock does not replace Firebase authorization for business data.
Live staff enrollment requires a signed-in authorized account. No documented
preview staff test account or preview bypass was found in README/setup docs;
mocked service/UI/provider tests and build checks do not prove real production
enrollment. Preserve the prior deployment for rollback, and have staff confirm
one new PIN setup followed by a lock/unlock using that PIN.
