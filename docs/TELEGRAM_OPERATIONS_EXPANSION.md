# Telegram operations expansion

## Remote commands

The bot adds owner-only commands:
- `/online`: active customer, staff and administrator sessions (last four minutes).
- `/jobs`: active carwash jobs.
- `/attendants`: active and completed job counts by attendant.
- `/payments`: recent order payment-status overview.
- `/alerts`: recent warning, error, denial, security and refund audit events.
- `/health`: Firestore and Telegram connectivity/configuration checks.
- `/emergency_lockdown`: disables Telegram management/reporting commands.
- `/unlock_remote_admin`: owner-only restoration of Telegram management/reporting commands.

The emergency lock applies only to the Telegram remote console. It does not suspend POS logins, application writes, payment processing or other application access.

## Event alerts

The authenticated event endpoint accepts signup/sign-in, failed sign-in, carwash creation/status/assignment/completion, stock adjustment/low stock, staff creation/role changes, payment failures, reconciliation discrepancies, refunds, expense submission/decisions, admin CRUD, access changes and suspicious activity.

Financial, expense, refund, access-control and admin-audit events require a privileged application profile or configured admin record. Emit these only after the trusted business operation has committed. Client-originated notifications are not settlement proof.

Manager notifications are filtered to their configured branch IDs; owners receive cross-branch alerts.

## Schedules

All scheduled routes require the Vercel `CRON_SECRET` bearer authorization:
- Every three minutes: live account roster and incremental audit forwarding.
- Hourly: operational pulse including recent client orders and held bills.
- Morning and evening: daily operations and financial summary.
- Monday at 06:00 Africa/Nairobi: seven-day recorded-order performance report.

The weekly report is capped at the latest 1,000 orders. Payment status summaries reflect application records, not provider settlement files.
