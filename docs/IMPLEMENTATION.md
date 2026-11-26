# URBAN LLC | Unified Business OS Implementation Roadmap

## 1. Documentation Package Overview

This project is governed by a 10-point documentation framework to ensure enterprise-grade stability, security, and scalability.

| #  | Document | Status |
| -- | -------- | ------ |
| 01 | [Project Scope, MVP & Architecture](./README.md) | ✅ Complete |
| 02 | [Product Requirements Document (PRD)](./PRD.md) | 🟢 Active |
| 03 | [Software Requirements Specification (SRS)](./SRS.md) | 🟢 Active |
| 04 | [UI/UX & Design System Specification](./DESIGN_SPEC.md) | 🟢 Active |
| 05 | [Database & ERD Specification](./DATABASE_SPEC.md) | 🟢 Active |
| 06 | [API & Integration Specification](./API.md) | 🟢 Active |
| 07 | [Security, Audit & Fraud Control Specification](./SECURITY.md) | 🟢 Active |
| 08 | [POS Hardware & Paystack Integration](./HARDWARE_PAYMENT_SPEC.md) | 🟢 Active |
| 09 | Business SOP & Employee Operations Manual | 🟡 Pending |
| 10 | Testing, Deployment & Maintenance Plan | 🟡 Pending |

## 2. Master System Requirements Matrix

All development tasks must map to a business requirement.

### POS & Sales Flow
- **Lounge POS**: Table management, split billing, multi-method payment.
- **Store POS**: Barcode scanning, automated inventory deduction.
- **Carwash Queue**: Vehicle registration, attendant assignment, status tracking.

### Control & Audit
- **Fraud Detection**: Real-time monitoring of voids, high-value refunds, and cash variances.
- **Petty Cash**: Formal request/approval workflow with digital audit trail.
- **Audit Logs**: Non-repudiable logs for every system action.

## 3. Tech Stack
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS.
- **UI Components**: Shadcn UI.
- **Database/Auth**: Firebase Firestore & Firebase Authentication.
- **AI Engine**: Google Genkit (Gemini 2.5) for fraud detection and reporting.
- **Payments**: Paystack API integration.

---

# 4. Product UX/UI Description — Complete Page Specification

## 4.1 Design Direction

The product should have a **premium automotive + hospitality corporate aesthetic**.

### Brand Feel
- Professional, Premium, Operational, Fast, Clean, Trustworthy, Data-focused.
- **Visual Language**: Light backgrounds for management, charcoal navigation, **Urban Red** primary accents.
- **UX Principle**: Every transaction should have a clear beginning, owner, status, financial result, and audit trail.

## 4.2 Application Structure
- **AUTHENTICATION**: Secure entry gate.
- **DASHBOARD**: Central command center.
- **POS**: Specialized Retail and Lounge interfaces.
- **OPERATIONS**: Carwash queue and Employee management.
- **INVENTORY**: Stock control and adjustment ledger.
- **FINANCE**: Cash management and Petty Cash workflow.
- **REPORTS**: Business intelligence and Fraud/Risk alerts.

## 4.3 Key Module Specifications

### POS (Retail & Lounge)
- **Retail**: Three-column structure (Categories | Products | Cart). Barcode focus.
- **Lounge**: Visual table map with status indicators (Available, Occupied, Reserved).
- **Kitchen Display**: Status-based order board (New -> Preparing -> Ready -> Served).

### Carwash Operations
- **Queue Management**: Visual cards for active/queued jobs with attendant assignments.
- **Vehicle Inspection**: Mobile-first before/after evidence capture (scratches, dents).
- **Attendant Mobile**: Simplified interface for job start/complete actions.

### Inventory & Finance
- **Stock Adjustment**: Highly controlled screen with mandatory reason codes and audit logging.
- **Petty Cash**: Formal request-approval workflow with digital document/photo evidence.
- **Shift Reconciliation**: Blind drop cash counting with automated variance alerts.

### Security & Fraud
- **Risk Dashboard**: Aggregated alerts for suspicious refunds, voids, and stock discrepancies.
- **Investigation Portal**: Transaction timelines with linked audit events and employee history.
- **Immutable Audit Log**: Timeline of all system actions with unique Audit IDs.

## 4.4 Mobile Strategy
The mobile UI is not a shrunken desktop version but a specialized operational tool:
- **Cashier**: Sales & Shift focus.
- **Attendant**: Job queue & Inspection focus.
- **Manager**: Real-time alerts & Approvals focus.

---

## 5. Master System Requirements Matrix (Expanded)
Every feature must link: **Business requirement → screen → API → database table → permission → audit event**.
