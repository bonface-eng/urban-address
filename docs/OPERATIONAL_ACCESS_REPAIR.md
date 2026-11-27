# Checkout, reporting and directory access repair

## Scope

This release replaces final checkout on Lounge, Store and Carwash POS with a
fixed authenticated server transaction. The caller must be an active manager or
cashier (cashiers require the selected assignedUnits entry). The server verifies
Firebase token revocation, re-reads actor status in the transaction, validates
catalogue unit/price/archival and quantities, and derives actor, prices, totals,
time and commissions from server records. Physical stock cannot go below zero;
Carwash services do not decrement synthetic stock. Carwash job/vehicle updates
are included. Owned pending tab cleanup never targets another operator; legacy
tabs already marked inventorySynced require manual review instead of risking a
second stock deduction.

Orders, stock, audit, operation marker, payment-reference lock and Carwash job
commit together. Stable per-account operation IDs are retained in sessionStorage
after unknown results. Retrying the identical checkout returns the original
receipt without another sale or stock deduction. An altered cart while unknown
is blocked. Do not clear the pending marker to force a new sale; reconcile Sales
History first. Definitive pre-commit rejections allow corrected input. Automatic
network mutation retries are not used. Receipt print failures cannot label a
committed sale failed.

Cash is recorded by an authenticated operator with sufficient cash received.
Manual mobile references preserve existing staff-recorded payment behavior and
are explicitly tagged STAFF_RECORDED_MOBILE, not processor verified. Automatic
Paystack payments are independently verified server-side for successful status,
KES currency, exact amount and reference. Reference reuse is transactionally
blocked. No real payment or sale is generated in tests.

Management reports/history/audit and the full Employees directory now use fixed
server resources restricted to manager/admin/supervisor eligibility. Directory
fields needed for management include salary and payout number but never password,
masterKey, PIN/hash, tokens or arbitrary user fields. Attendant selectors return
only basic operational identity. Operator own-order reads are always filtered by
authenticated UID. Fixed staff job/terminal snapshots replace relevant remaining
browser reads on Dashboard, Carwash and Attendants. Resource/parameter allowlists
prevent arbitrary collection paths. Data is paginated, projected and no-store.
Snapshots have refresh controls; operational snapshots refresh while visible.

## Preserved / not repaired

This is not a generic database bypass or Firebase Console ownership recovery.
Firebase rules, account roles, existing stock/sales/PINs and login settings are
unchanged by deployment. Held-tab creation/ticket writes, cancellations,
reconciliation, refunds, payroll payouts, advanced admin subpages, staff-account
creation/deletion/password reset/role editing and other client writes retain
existing implementations and may still be denied. This release repairs directory
READS, not account-management actions. Report management access is intentionally
stricter than old client-only display checks. Other app errors are not all fixed.

## Verification limits

Service/endpoint/client/mock UI tests exercise authorization, idempotency,
concurrency, audit rollback, payment validation, field filtering, pagination,
unknown responses and receipt-print errors. They do not prove a real signed-in
sale is successful. No documented preview staff test account/bypass was found in
README/setup guidance; do not use shared production passwords. After deployment,
verify read-only report/directory views first, then an intended real checkout once.
On unknown results retry only the same unchanged transaction; never blindly start
a duplicate. Retain the previous deployment for rollback.
