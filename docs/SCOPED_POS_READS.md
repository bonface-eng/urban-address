# Scoped staff-page read recovery

This release addresses the confirmed ACCESS_USERS_LIST sources on POS pages:
customer lookup and each signed-in operator's held tabs. It also replaces direct
inventory reads on Lounge, Store, Carwash POS, Carwash jobs and Dashboard with the
already-authorized inventory service.

GET /api/pos-reads accepts only resources `customers` and `own-tabs`, optional
unit (STORE/LOUNGE/CARWASH), and document cursor. It rejects arbitrary collection
paths, user IDs and unknown query parameters. Every page verifies Firebase token
revocation, existing active profile and staff role or verified existing root/admin
registry eligibility. Admin emails from request/profile data confer no authority.

Customer lookup returns UID, CLIENT role, display name, phone, email and loyalty
points only. No credential, payroll or private staff-profile fields. Only CLIENT
records are queried. Own held tabs are read exclusively under the authenticated
UID; even admins cannot target another operator through this endpoint. Responses
project only order/item fields needed to recall that operator's draft. Reads are
paginated by document ID and never write data.

The client clears snapshots on account changes, rejects incomplete page results,
shows local errors with safe POS_* references, and supports retries. Own tabs
refresh every 30 seconds while the page is visible, plus manual retry. Inventory
is a snapshot and reloads when the page is refreshed. Customer search no longer
fails silently because the first 20 records were unrelated; the authorized lookup
snapshot is paginated across CLIENT records.

## Explicit limits

This is NOT a generic database bypass or full-application migration. Checkout,
sales, held-tab creation/modification, reports, staff-management queries, attendant
selection, carwash jobs, dashboard orders and terminals retain their existing
Firestore reads/writes and can still fail under the inaccessible live rules. Do
not suppress those errors or claim they are repaired. The same ACCESS_USERS_LIST
reference may still refer to attendant/staff-management or other user subqueries;
the global reference intentionally omits private document IDs.

No Firebase rules, role/account records, stock, PINs or sales modified in tests.
Actual signed-in page recovery remains unverified: no documented preview staff
test account/bypass found in README/setup guidance. Tests use mocks; they are not
proof a real sale/checkout completes. User should refresh the POS page and check
customer search/product visibility/own recall list; never retry unconfirmed sales
blindly. Preserve prior deployment for rollback.
