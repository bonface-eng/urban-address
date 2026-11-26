# Software Requirements Specification (SRS)

## 1. Non-Functional Requirements
- **Performance**: POS transactions must process in < 500ms.
- **Security**: RBAC (Role-Based Access Control) for all sensitive operations.
- **Availability**: Offline-first capability for POS modules.
- **Auditability**: Every action (void, refund, login) must generate a non-repudiable audit log.

## 2. Authentication & Authorization
- PIN-based login for quick cashier switching.
- Biometric/Password fallback for administrative tasks.
- Approval hierarchy: Supervisors must authorize specific "High Risk" actions.

## 3. Integration Requirements
- **Paystack API**: For card and mobile money processing.
- **SMS/WhatsApp Gateway**: For automated customer receipts and owner alerts.
