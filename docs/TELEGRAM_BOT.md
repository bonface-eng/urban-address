# Urban Address Telegram Operations

The Telegram bot is an operational interface for authorized owners, managers and staff. Access is granted by numeric Telegram user ID and an assigned role. Unknown accounts are denied by default.

## Roles

- **OWNER**: full management reporting and petty-cash decisions across branches.
- **MANAGER**: management reports and petty-cash decisions within configured branch scope.
- **STAFF**: authenticated bot access and role/branch self-check; staff receive operational notifications when their Telegram account is configured. Staff cannot approve expenses or access management reports.

## Commands

The bot's `/help` response is role-aware: staff see only their available commands, while owners and managers see the management command set.

| Command | Purpose | Owner | Manager | Staff |
| --- | --- | --- | --- | --- |
| `/start` | Connect and confirm the Telegram account is authorized | Yes | Yes | Yes |
| `/help` | Show commands available to the configured role | Yes | Yes | Yes |
| `/myrole` | Show configured role and branch assignment | Yes | Yes | Yes |
| `/dashboard` | Revenue, paid orders, active carwash jobs and low-stock overview | Yes | Yes | No |
| `/sales` | Today's sales totals by Lounge, Store and Carwash | Yes | Yes | No |
| `/inventory` and `/stock` | List items at or below their restock threshold | Yes | Yes | No |
| `/branches` | Show branches visible to the manager's assigned scope | Yes | Yes | No |
| `/shifts` | Show recent register sessions | Yes | Yes | No |
| `/report` | Daily operations and sales summary | Yes | Yes | No |
| `/lock_terminal TERMINAL_ID` | Disable a POS terminal after owner confirmation | Yes | No | No |
| `/unlock_terminal TERMINAL_ID` | Re-enable a POS terminal after owner confirmation | Yes | No | No |
| `/expenses` | List pending petty-cash requests with inline Approve / Reject buttons | Yes | Yes | No |
| `/summary` | Combined daily operations and sales summary | Yes | Yes | No |

**Staff access:** staff accounts can connect, view their own configured role and receive operational notifications when an administrator has configured their Telegram ID. Staff cannot run management reports or approve petty cash.

**Approval controls:** pending petty-cash requests are sent with inline Approve and Reject controls. Decisions are rechecked against the current pending state inside a Firestore transaction and written to the audit log. A Telegram callback is not treated as proof of authorization; the actor's configured role and branch scope are checked server-side.

## Required Vercel environment variables

Configure these as server-only environment variables. Never put credentials in source files, documentation, query strings or chat messages.

- `TELEGRAM_BOT_TOKEN`: token issued by BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: random secret of at least 32 characters; Telegram sends it in the webhook secret-token header.
- `TELEGRAM_USER_ACCESS`: JSON object keyed by Telegram numeric user ID. Each entry has a role (`OWNER`, `MANAGER`, or `STAFF`), optional `branchIds` array, and optional display `name`.

Example structure (use real IDs and branch IDs in Vercel only):

```json
{
  "123456789": { "role": "OWNER", "name": "Business Owner" },
  "234567890": { "role": "MANAGER", "name": "Branch Manager", "branchIds": ["branch-id"] },
  "345678901": { "role": "STAFF", "name": "Staff Member", "branchIds": ["branch-id"] }
}
```

The example IDs are placeholders. The webhook fails closed if its secret is missing or invalid. Rotate any previously committed bot token and webhook secret before enabling production.

## Reliability and audit

Webhook updates are recorded in `telegram_updates` by Telegram update ID. Completed updates are ignored on redelivery; failed processing is recorded and returns a retryable server error. Petty-cash decisions are transactional and recorded in `audit_logs`. Do not manually edit these records to force a decision.

## Current integration boundary

The bot provides command-driven reporting and petty-cash approval. The server-side `notifyTelegramOperations` helper provides a safe integration point for sales, payment, carwash and inventory event producers. Call it only from trusted server-side business workflows after the underlying operation succeeds. Daily summaries are available using `/summary`; scheduling an automatic daily push requires a Vercel Cron schedule and the deployment's cron authorization configuration.


## POS sale notifications and staff self-linking

Cashier, Lounge, Store and Carwash POS sales dispatch a Telegram alert only after the sale is committed. The message includes the sale reference, amount, unit, payment method, cashier identity, POS terminal, register session, branch, item lines and East Africa Time. Telegram delivery is idempotent per order through `telegram_sale_notifications/{orderId}`; successful recipients are not repeated if a partial delivery is retried.

Recipients are merged from the legacy `TELEGRAM_USER_ACCESS` environment variable and Firestore `telegram_user_access` records. A database record overrides a legacy entry, including explicit revocation. Branch filters are applied to OWNER / MANAGER / STAFF recipients.

Staff can connect their own account from **Profile → Telegram notifications**. They open the bot, press Start, copy the numeric Telegram ID shown by the bot, enter it in their profile and confirm a six-digit code delivered to that Telegram account. The server derives the Telegram role and branch assignments from the authenticated Firebase staff profile; no one can assign themselves a higher role from the form. Link challenges expire after five minutes and are limited to five code attempts.


## Three-minute monitoring and remote terminal controls

The live monitor runs every three minutes. It sends a roster of accounts whose server-verified presence heartbeat was received within the last four minutes, separated into customers, staff and administrators. The same monitor forwards new `audit_logs` records in bounded pages and advances its cursor only after all management recipients receive the batch. The app heartbeat runs every three minutes while an authenticated session is active. This covers activity that is actually written to the central audit log; every business workflow must write its successful data change there to be reported.

Owners can use `/lock_terminal TERMINAL_ID` and `/unlock_terminal TERMINAL_ID`. Both actions require an inline confirmation, are recorded in `audit_logs`, and are enforced by the terminal PIN API so a disabled device cannot register or authenticate staff. Re-enabling remote Telegram administration is separate from re-enabling an individual terminal.

The current interactive approval workflow is for pending petty-cash requests. Refund execution, payment reversals, stock writes, and staff-account suspension are not exposed as Telegram mutations; they must continue through their existing authenticated application workflows. The bot reports payment, inventory, staff and operational events where the app emits the corresponding event/audit record. No microphone or audio-recording functionality is included in this rollout.

## Security alerts

Security and authentication events generate Telegram alerts for configured management recipients. The alert contains a masked email, action purpose, and request telemetry. Values, hashes, and verification links are never sent to Telegram.

## POS sales analytics schedule

- Every 15 minutes: paid sales totals grouped by POS terminal/station, including order count and total revenue for the previous 15 minutes.
- Every hour: cashier performance for the previous 60 minutes, including sales count, revenue, average sale and department totals.
- Every 12 hours: top 10 selling items over the previous 12 hours, ranked by quantity sold with revenue shown.
- On demand: /station_sales, /cashier_report, and /top_items provide the same reports to authorized managers and owners.

Sale alert titles identify the POS station; terminal sign-in alert titles use the registered station name. If an order has no terminal metadata, the sale is labelled as an unassigned station. Analytics are calculated from paid orders only and are capped at the latest 3,000 matching orders per report to bound Firestore reads.


## Remote approvals and operational controls

The bot supports these additional owner/manager workflows:

- `/request_refund ORDER_ID AMOUNT REASON` creates a pending refund request for an existing paid order. `/refunds` presents review and confirmation buttons. Approval records authorization only; it does **not** initiate a payment-provider refund or mark the order as refunded. The actual refund must still be completed through the authorized payment workflow and confirmed by its provider callback.
- `/request_stock_adjustment PRODUCT_ID +/-QUANTITY REASON` creates a stock adjustment request. `/stock_adjustments` presents review and confirmation buttons. Approval checks that the product stock has not changed since the request was submitted, then updates inventory and writes an audit record in one Firestore transaction.
- `/lock_station TERMINAL_ID` and `/unlock_station TERMINAL_ID` set server-controlled terminal lock state and write audit records. The POS client watches its terminal document and locks the station when the remote lock is applied. The PIN endpoint also rejects a disabled or locked station.
- `/cashier_sessions` lists active register sessions. Managers can end a session within their branch scope using its inline control; owners can also use `/end_cashier_session SESSION_ID`. Ending a session remotely closes the register and locks the terminal; it does not invent a cash count.
- `/reconcile_shift SESSION_ID ACTUAL_CASH` calculates expected cash from the opening float plus paid cash orders less recorded cash refunds associated with the register session, asks for confirmation, closes the register and records the cash variance. Large variances are sent to management.
- `/reconciliations` lists recent cash reconciliation results.
- `/incidents` lists open and acknowledged system incidents with acknowledge/resolve controls. `/raise_incident MESSAGE` creates an operational incident. `/emergency_alert MESSAGE` is owner-only and broadcasts a critical alert to configured management accounts.

The `/api/telegram/stock-monitor` Vercel Cron endpoint checks active inventory every 15 minutes. Low-stock alerts are deduplicated per item for six hours; a recovery clears the active alert state so a later stock drop can alert again. It requires the existing `CRON_SECRET`.

## Security boundaries

All Telegram callbacks re-check the caller's current bot role and branch scope, check the remote-administration lockdown, prevent a requester from approving their own refund or stock adjustment, and use Firestore transactions for state transitions. Approvals are one-way from PENDING and duplicate callbacks cannot apply a second change. Telegram remote terminal flags are protected from client-side Firestore updates. Ordinary staff cannot make manual inventory adjustments through the inventory screen; they submit those changes as Telegram requests for manager approval. Firestore still permits the lower stock values required by paid POS sale deductions, while stock increases and manual adjustments remain owner/server controlled. Refund approval remains separate from actual money movement. No passwords, OTP values, payment credentials or microphone recordings are sent to Telegram.
