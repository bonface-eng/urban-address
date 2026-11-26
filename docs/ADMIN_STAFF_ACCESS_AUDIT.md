# Admin and Staff Page / Firestore Access Audit

**Baseline:** `main` at `397399c6ad7267e47b97ed6496972dd2cb62a89a` (2026-11-26)  
**Scope:** Next.js route guards, shared profile reads, client Firestore paths and the root `firestore.rules`.  
**Release status:** Proposed on a review branch. Firestore Emulator and live-role verification are still required before production deployment.

## Main finding fixed

`src/hooks/use-profile.ts` subscribes to both:

- `users/{uid}` for the signed-in user's own profile.
- `admins/{lowercase-email}` to resolve the optional administrator whitelist.

The second subscription runs for ordinary customers and every staff role. Before this change, `firestore.rules` allowed all reads of `admins/{email}` only when `isSuperAdmin()` was already true. A normal cashier, storekeeper, attendant, kitchen user or customer therefore received a predictable `permission-denied` response from the shared profile provider, even when they were not trying to access an admin feature. The global `FirebaseErrorListener` converted that into an “Access restricted” toast.

**Correction:** allow an authenticated user to perform a document `get` only when the document ID exactly matches the email in their verified Firebase Auth token. Keep directory `list` and all create/update/delete operations super-admin-only. This does not expose other administrators' records and does not grant an ordinary user administrative permissions.

## Shared route and role enforcement

| Surface | Application behavior | Firestore enforcement | Audit result |
| --- | --- | --- | --- |
| `AppShell` / protected staff routes | Requires authentication; resolves role; checks `system/permissions`; applies assigned-unit routing for cashier, attendant, storekeeper and kitchen roles. | `system/permissions` is readable by signed-in users; writes are super-admin-only. | Aligned. Matrix is navigation/route control, not a replacement for rules. |
| `ProfileProvider` | Reads own profile and own email's optional admin whitelist record. | `users/{uid}` owner read; `admins/{email}` own-email get after this patch. | Fixed false permission denial. |
| `/admin/*` layout | Wrapped in the daily administrator OTP guard. | Privileged rules require the current-day OTP claim for `ADMIN` and super-admin identities. | Aligned; managers/supervisors remain governed by the existing documented policy. |
| `/dashboard` | Staff overview; uses role-aware aggregates and the signed-in user's held bills where appropriate. | Staff read for orders, inventory and terminals; owner/staff access to held bills. | Aligned for supported staff roles. |
| `/kds` | Kitchen order board; updates preparation state and served timestamp. | Staff can read orders; kitchen updates are restricted to preparation fields and valid states. | Aligned. Kitchen reads the order document as a whole; consider a dedicated kitchen-ticket projection if kitchen users must not see non-preparation order fields. |
| `/lounge` | Lounge POS; reads lounge inventory, orders and cashier held bills; creates/updates sales and stock. | Staff inventory read; non-kitchen operational writes; held-bill access for owner or non-kitchen staff. | Aligned for manager, supervisor and cashier flows. |
| `/store` | Retail POS; reads store inventory, orders and cashier held bills; records sales and stock movement. | Same scoped operational rules as lounge. | Aligned for manager, supervisor and cashier flows. |
| `/carwash` | Service queue; reads jobs and carwash inventory; updates job state and writes audit events. | Staff read/update for jobs except kitchen; staff inventory read; non-kitchen audit creation. | Aligned. |
| `/carwash/pos` | Creates orders/jobs, reads attendant directory and held bills, and records vehicles. | Non-kitchen staff access to orders, carwash jobs, users, held bills and vehicles. | Aligned for authorized carwash staff. |
| `/inventory` | Inventory catalog, import/export and stock transfer. Stock increases are super-admin-controlled in the UI. | Staff read; admin create/delete; non-kitchen update; stock increase is limited to super-admin, while decreases are allowed operationally. | Aligned with the stock-control rule. Test all transfer directions with a cashier and storekeeper. |
| `/employees` | Staff/customer directory and staff role management. Staff creation uses the trusted admin endpoint; profile changes and audit events use Firestore. | Non-kitchen staff read directory; admin update/delete; non-kitchen audit create. | Aligned; verify the API route independently because Admin SDK bypasses Firestore rules. |
| `/attendants` | Reads attendant profiles and carwash jobs; updates attendant profile details. | Non-kitchen staff read users; staff read jobs; admin updates user profiles. | Aligned for staff-directory read; mutation must be restricted to authorized manager/admin UI and verified server-side where applicable. |
| `/finance` | Petty-cash request creation, manager approval and cash reconciliation. | Staff read/create petty cash; admin update; reconciliation read/write admin-only; staff audit creation. | Aligned with the current manager/supervisor approval policy. |
| `/sales-history` | Reads orders; role-aware views; privileged pending-record clearance and audit logging. | Staff read orders; admin delete; staff can manage their held-bill records; staff audit create. | Aligned. Paid-order deletion should remain unavailable through the UI workflow. |
| `/reports` | Reads paid order data and builds reports; route visibility is governed by AppShell's role matrix. | Staff read orders. | Rules align with staff reporting access; keep the route matrix restrictive because the underlying query is broad. |
| `/customers` | Reads client profiles and customer records. | Non-kitchen staff can read users; customer self-read remains available. | Aligned for authorized staff. |
| `/suppliers` | Supplier catalog and procurement operations. | Admin read/create/update/delete. | Aligned for manager/supervisor/admin roles; super-admin-only delete control is stricter in the UI. |
| `/admin` access matrix | Reads permissions, config, staff, terminals, branches and audit history; writes settings, broadcasts, terminals and branch assignments. | Permissions readable by signed-in users; sensitive config and whitelist restricted; branch management super-admin; audit logs read-admin/create-staff; notification recipient rules. | Fixed: every panel listener is now gated by super-admin before subscribing, preventing staff from triggering denied config/audit reads behind the hidden page. |
| `/admin/digital-menu` | Reads inventory and writes the main digital menu. UI requires super-admin. | Inventory staff read; `digitalMenus/main` admin write. | Aligned for OTP-verified super-admin sessions. |
| `/admin/system-errors` | Reads and resolves system incident records. | Incident create is owner-scoped; read/update is super-admin-only. | Aligned. |
| `/admin/live-audio` | Admin requests and assigned cashier participation. | Audio-admin session control; assigned cashier can access only their session; candidate subcollections are session-scoped. | Aligned with dedicated audio rules. |
| `/admin/branches` | Branch directory management. | Signed-in read; super-admin create/update; client delete denied. | Aligned. |
| `/admin/payroll` | Staff payroll and salary-advance workflows. | Salary advances readable by non-kitchen staff; writes admin-only. | Aligned with the documented rule model. |
| `/admin/app-manager` | Public release display and admin release management. | Public read; admin write. | Aligned. |
| `/admin/email`, `/admin/telegram`, payment/auth APIs | Server-backed integrations. | Server routes use Firebase Admin SDK and are not constrained by client Firestore rules. | Must retain independent Firebase ID-token, role and input validation in each route. |

## Role summary

| Role | Expected access |
| --- | --- |
| `ADMIN` | Administrative access after current UTC-day OTP verification. |
| `MANAGER` | Management and approval access under the existing policy; no daily OTP requirement in the current rules. |
| `SUPERVISOR` | Supervisory and approval access under the existing policy; no daily OTP requirement in the current rules. |
| `CASHIER` | Assigned POS station(s), orders, held bills, customer/staff lookup and operational workflows permitted by assigned units. |
| `STOREKEEPER` | Inventory/stock workflows and explicitly assigned operational pages; stock increases remain super-admin-controlled. |
| `ATTENDANT` | Assigned carwash workflows and attendant-specific views; no general finance or administration. |
| `KITCHEN` | KDS order read and constrained preparation-state updates only; not general sales, inventory, profile, payroll or cash operations. |
| `CLIENT` | Own profile, own orders and customer-facing features only. |

## Notification presentation

The toast primitive was restyled to a neutral light surface:

- White background and restrained zinc borders/text.
- No black/dark background.
- No primary/accent or red/green/amber stripe.
- Neutral close/action controls, readable title and description, and bottom-right placement.
- Success and error meaning remains in the message text and accessibility semantics; the visual treatment no longer relies on accent colours.

## Validation still required

1. Run the Firebase Rules Emulator/compiler against the updated `firestore.rules`.
2. Test signed-in customer, cashier, storekeeper, attendant, kitchen, manager, OTP-verified admin and super-admin sessions.
3. Confirm each role can read only its own `admins/{email}` record; verify `list` and writes remain denied for non-super-admins.
4. Exercise the POS, held-bill, carwash, KDS, finance, inventory and admin broadcast workflows in a Preview deployment.
5. Confirm the deployed Firebase project is the intended project before publishing rules.

A GitHub commit or Vercel deployment does not publish Firestore rules. Deploy the rules separately only after emulator and role testing.

## Additional administrator routes reviewed

| Route | Data path / access | Result |
| --- | --- | --- |
| `/admin/database` | Audit logs, orders, inventory, users and inventory backups; super-admin page. | Fixed: all five live queries now return `null` until `isSuperAdmin` is true. This prevents staff subscriptions from starting behind the rendered access-denied screen. |
| `/admin/intelligence` | Paid orders, inventory and the signed-in admin's AI chat history. | Fixed: orders, inventory and AI history subscriptions now require super-admin before subscribing. |
| `/admin/payroll` | Staff profiles, carwash jobs and salary advances. | Fixed: all three subscriptions now require super-admin. This prevents staff from reading salary advances or broad staff/job datasets by navigating directly to the route. |
| `/admin/support` | Support inbox records. | Fixed: the support query now starts only for super-admin. Non-admins no longer trigger a denied subscription before the access-restricted screen. |
| `/admin/assets` | Cloudflare/R2 asset workflow. | UI requires super-admin; access is through the server/storage integration rather than a broad client Firestore grant. Verify server authorization and R2 credentials independently. |
| `/admin/email` | Email campaign API and asset upload. | UI requires super-admin; server endpoint must independently verify Firebase identity and role. |
| `/admin/telegram` | Telegram status/access/webhook API routes. | UI requires super-admin; server endpoints must independently verify Firebase identity and role. |
| `/admin/help` | Administrator help content. | UI requires super-admin; no broad Firestore permission is needed. |
| `/admin/app-manager` | Public `app_releases` read, admin release writes and audit entries. | UI requires super-admin; the public read rule is intentional for the customer download/release surface. |
| `/admin/loyalty` | Server-side loyalty reconciliation endpoint. | UI supports admin, manager and supervisor; API must preserve the same explicit role allowlist and audit the reconciliation. |
| `/admin/documents` | Inventory read for report/export generation. | Read is allowed to staff by design; the route remains subject to AppShell's role matrix. No write permission is added. |
| `/admin/live-audio` | POS terminals, active live-audio sessions, session candidate subcollections and audit events. | Listener creation is gated by the page's admin check; Firestore session control remains restricted to OTP-verified admin/super-admin and the assigned cashier. |

## Query-gating changes in this branch

The following super-admin screens now avoid constructing Firestore subscriptions until the role is resolved and authorized:

- `src/app/admin/page.tsx`
- `src/app/admin/database/page.tsx`
- `src/app/admin/intelligence/page.tsx`
- `src/app/admin/payroll/page.tsx`
- `src/app/admin/support/page.tsx`
- `src/app/admin/digital-menu/page.tsx`

This is a client-side data-minimization and error-prevention measure. Firestore Rules remain the actual security boundary. It does not replace server-side authorization for routes that use Firebase Admin SDK.
