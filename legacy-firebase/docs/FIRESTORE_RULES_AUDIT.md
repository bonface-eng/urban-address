# Firestore Rules Audit

This document records the client and administrator Firestore access paths reviewed alongside `firestore.rules`. The rules are intentionally collection-specific; unmatched collections remain denied.

## Authentication and role model

- Firebase Authentication remains the identity provider.
- Client-owned documents are scoped to `request.auth.uid`.
- Staff roles are resolved from `users/{uid}.role`.
- A terminal PIN-issued custom token marked `terminalStaffSession` is not accepted for privileged administration.
- `ADMIN` and super-administrator access requires the current UTC-day administrator OTP custom claims.
- `MANAGER` and `SUPERVISOR` retain the existing administrative permissions; the daily OTP requirement is intentionally limited to `ADMIN` and super-administrator identities, matching the current sign-in flow.
- Kitchen accounts retain order-board read access and constrained preparation updates, but are not general sales, inventory, profile, payroll or cash-management operators.

## Client and operational collections

| Collection / path | Application workflows | Rules intent |
| --- | --- | --- |
| `users/{uid}` | Signup/profile, client profile, staff directory, customer lookup, account settings | Owner reads own profile; non-kitchen staff can read profiles for staff/customer operations; owner updates only approved profile/consent-adjacent fields; admin manages staff. |
| `users/{uid}/fleet/{plate}` | Client profile and carwash booking | Owner or authorized non-kitchen staff. |
| `users/{uid}/held_bills/{billId}` | Store, lounge and carwash POS hold/recall | Owner or authorized non-kitchen staff; kitchen excluded. |
| `users/{uid}/ai_chats/{chatId}`, `memories/{memoryId}` | Personal assistant history/settings | Owner or admin. |
| `orders/{orderId}` | Client bookings/payments, store/lounge/carwash POS, sales history, reports, KDS | Client creates only a constrained own order; non-kitchen staff operate sales; kitchen reads tickets and changes only preparation fields/state; admin controls deletion. |
| `carwash_jobs/{jobId}` | Client booking, carwash operations, attendant/payroll views | Customer can create own job; staff manage jobs except kitchen. |
| `inventory/{productId}` | Catalogue, store/lounge POS, inventory and stock valuation | Staff read; non-kitchen staff write. |
| `vehicles/{plate}` | POS vehicle recognition and loyalty reconciliation | Staff read/write except kitchen. |
| `digitalMenus/{menuId}` | Public digital menu and admin menu editor | Public reads only published main menu; admin manages the main menu. |
| `branches/{branchId}` | Client payment branch selection and branch administration | Signed-in read; super-admin manages branch records. |
| `reviews/{reviewId}` | Public reviews and authenticated review submission | Public read; authenticated owner creates/deletes own review; admin moderates. |
| `support_queries/{queryId}` | Public contact form and admin support inbox | Validated public create; admin reads and manages. |
| `notifications/{id}` | Customer/staff notifications and admin broadcasts | Recipient reads and marks read; admin can manage and broadcast. |
| `account_deletion_requests/{id}` | Customer account deletion request and admin review | Customer creates/reads own request; admin reviews; no client deletion. |
| `app_releases/{id}` | Public release briefing and admin release manager | Public read; admin writes. |
| `system_incidents/{id}` | Client error telemetry and admin incident console | Authenticated user creates only own bounded incident; admin reads/resolves. |
| `audit_logs/{id}` | Staff/admin operational audit trail | Non-kitchen staff create; admin reads; client updates/deletes denied. |
| `settings/{id}` | Receipt configuration and operational settings | Staff read; admin writes. |
| `system/permissions`, `system/config` | Admin access matrix and global configuration | Authenticated staff can read permissions; super-admin controls sensitive system documents. |
| `admins/{email}` | Admin whitelist lookup/management | Super-admin only. |
| `pos_terminals/{id}` | Terminal assignment and live-audio terminal list | Staff read; non-kitchen staff write. |
| `register_sessions/{id}` | Cash register open/close lifecycle | Non-kitchen staff only. |
| `live_audio_sessions/{id}` and candidate subcollections | Admin-to-cashier live audio | OTP-verified admin/super-admin control; assigned cashier can participate only in the session addressed to them. |
| `petty_cash/{id}`, `reconciliations/{id}`, `salary_advances/{id}` | Finance, reconciliation and payroll | Finance/staff read/create as specified; admin controls approvals and reconciliation; kitchen excluded. |
| `suppliers/{id}` | Supplier CRUD | Admin only. |
| `inventory_backups/{id}` | Admin database backup history | Admin only. |

## Administrator whitelist document lookup

- `ProfileProvider` checks `admins/{lowercase-auth-email}` for each signed-in account so it can resolve optional administrator whitelist membership.
- `firestore.rules` permits a signed-in user to `get` only the whitelist document whose ID exactly matches the email in their verified Firebase Auth token.
- Directory `list` and all writes remain super-admin-only. A user cannot probe another email's whitelist record or grant themselves admin status.
- This avoids the predictable permission-denied listener error previously emitted for ordinary users and staff.

## Server-managed collections

These collections are accessed through Firebase Admin SDK routes, not the browser Firestore SDK. Client access is explicitly denied in the rules; Admin SDK operations are not governed by Firestore client rules.

- `email_verification_otps/{uid}`: signup verification hashes, expiry, attempts and send counters.
- `admin_daily_otps/{uid}`: daily administrator OTP hashes and one-time consumption state.
- `email_rate_limits/{id}`: password reset and email rate limits.
- `email_preferences/{id}`: marketing consent and unsubscribe preferences.
- `email_outbox/{id}`: transactional receipt outbox/deduplication.
- `privacyConsent/{id}`: server-written privacy consent records.
- `terminal_pin_attempts/{uid}` and `terminal_devices/{id}/**`: server-only terminal PIN/device membership data.

## Kitchen Display System

The KDS at `src/app/kds/page.tsx` reads `orders` and updates only `prepStatus` and, when marking an order served, `servedAt`. The rules allow the kitchen role to change only the preparation fields (`kitchenStatus`, `prepStatus`, `updatedAt`, `kitchenUpdatedAt`, `servedAt`), constrain preparation state values to `NEW`, `PREPARING`, `READY`, `SERVED`, and require `servedAt` to be numeric and paired with `SERVED`. Kitchen accounts cannot create sales orders.

## Deployment and validation

- `firebase.json` points Firestore deployment at the root `firestore.rules` file.
- Firestore rules deployment is separate from a GitHub merge or Vercel deployment.
- The repository did not contain Firebase Rules Emulator unit tests when this audit was performed. A balanced-brace/parenthesis structural check was performed on the proposed rules, but that is not a substitute for compiling and exercising the rules in the Firebase Emulator.
- Before production publication, run the Firebase Rules compiler/Emulator tests against representative customer, cashier, kitchen, manager, admin and super-admin sessions.
- Admin SDK routes bypass these rules. Their Firebase ID-token checks, role checks and input validation must remain independently enforced.
