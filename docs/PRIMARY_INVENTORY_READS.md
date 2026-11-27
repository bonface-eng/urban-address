# Management inventory: primary authorized server reads

The screenshot confirmed INVENTORY_READ_DENIED, not a network error. The previous
fallback intentionally did not run after that code; no /api/staff-inventory
request reached Vercel. Management Inventory now directly uses the authenticated
server endpoint for every read, not the browser collection subscription. This is
an explicit authorization architecture change, not removal of authorization.

Every page verifies a fresh Firebase identity token, revocation status, an active
existing staff profile and staff role or verified existing root/admin-registry
eligibility. Nonstaff, inactive, missing and unauthenticated accounts stay denied.
Server policy is implemented in /api/staff-inventory; it does not deploy or relax
Firestore client rules. All inventory mutations continue through their original
client write paths and permission checks. This read change does not repair those
write permissions if the live rules reject them.

Reads are paginated snapshots. Refresh inventory re-runs the snapshot; completed
local operations trigger refresh. No real-time subscription is promised. Auth
signout/account switches and refresh immediately hide stale data. Partial-page
results never appear as a complete catalogue. Existing keys, roles, PINs, profile
setup and stock records are unchanged.

No real inventory records or live database rules were inspected. No documented
preview staff account/bypass exists in the inspected setup guidance, so the
signed-in flow remains unverified by Agent. After deploying, refresh Inventory
and report the resulting INVENTORY_* code if the independently authorized server
also denies access. Do not import/restore stock merely because a read fails.

Scope is the reported Inventory read, not all application errors. Other screens'
Firestore warnings and write permissions may still require separate fixes.
