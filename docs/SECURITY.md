# Security & Fraud Control Specification

## 1. Fraud Prevention Mechanisms
- **Void Tracking**: Every voided item requires a reason code and supervisor PIN.
- **Price Overrides**: Logged as "Suspicious" if deviating > 5% from standard price.
- **Cash Variance**: Mandatory "Blind Drop" reconciliation at end of shift.
- **Device Fingerprinting**: System only accessible from authorized POS terminals.

## 2. Audit Logging
All transactions are stored with:
- Timestamp (Server-side).
- User ID & Role.
- Terminal ID.
- Hash-chaining to detect database tampering.
