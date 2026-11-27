# PIN administrator eligibility correction

The terminal PIN API previously recognized only a staff role in users/{uid},
whereas the application's ProfileProvider also recognizes its existing root-admin
email list and admins/{email} registry. This caused an authorization mismatch for
an otherwise recognized administrator whose profile role is CLIENT or absent.

The PIN service now accepts either the existing staff role or root/admin-registry
eligibility. The root list is shared with ProfileProvider. Email-based server
eligibility uses only email and email_verified from a revocation-checked Firebase
ID token. The browser's request/profile email cannot grant privilege. An
unverified email using admin fallback receives an explicit verification-required
message. Ordinary staff-role accounts retain the existing eligibility behavior.

A users/{uid} profile must still exist and must not be disabled/inactive. The
fallback does not create profiles, modify roles, clear PINs or bypass recent-auth,
self-only, enrollment-version or guessing limits. Firebase-disabled accounts
remain rejected by ID-token revocation checks. Existing PIN data is untouched.

This patch is based on production source 86a33aeca0260a3db62a50b9d4f5d57abbc1f082.
GitHub was disconnected by the owner and is not reconnected. The local source
patch is supplied separately for the owner's records. A production deployment
from this workspace includes these local changes; its Git metadata alone may
still refer to the prior published source. Retain the patch with the release.

Tests establish the policy correction, not the affected account's database state.
No real account credentials or PINs were used. The signed-in flow is not reachable
for browser verification without a documented preview staff account, which was
not found in the repository setup guidance. After deployment, sign out, refresh,
sign in again, and retry staff PIN setup. If blocked, report the on-screen error
text, never the password, token or PIN.
