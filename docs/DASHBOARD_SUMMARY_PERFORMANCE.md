# Dashboard summary performance repair

Dashboard no longer invokes the sequential 200-record management history hook on
initial load. One authenticated /api/dashboard-summary request returns complete
period aggregates and five recent receipt previews. Per-period server queries
cover both numeric millisecond and Firestore Timestamp dates in parallel, using
single-field timestamp range queries (no new composite index required). Day
boundaries use the business timezone Africa/Nairobi. Own-only operator summaries
query the authenticated cashier UID then filter on server; management summaries
cover authorized global records. Existing revoked-token/active-profile policies
remain. No client UID overrides, data writes or rule changes.

All-time still requires a server scan of all authorized orders. Personal-history
queries and global pending totals can also be large. This release removes the
many browser round trips and large response payload but is not a precomputed
ledger or a claim of measured live latency. No private summary is globally cached.
Only complete sums are displayed; no partial-page sums masquerade as totals.
Period controls remain rendered while loading/error, so users can select a
smaller range instead of waiting for a full-history screen gate.

Chart/item/cashier aggregates are calculated from all paid records in the chosen
period; recent receipt rows are only a preview. Shift-report dialogs/downloads
explicitly fetch the complete selected-period detail on demand, not the five-row
preview. Reports can be slower for large ranges but never silently truncate.
Sales History browsing remains on its existing authorized paginated snapshot
path; its performance is not fully repaired here.

Read-only compatibility: supported timestamps normalize on response copies only;
no stored date/status/total is rewritten. Invalid/missing dates are not invented.
Pending backlog is separate from paid totals. Tests cover legacy dates, personal
scope, >200 records, complete totals/preview limits, details-only fetch and auth.
Actual signed-in speed/recovery remains unverified. No documented preview staff
test account/bypass exists in inspected setup guidance. Preserve prior release.
