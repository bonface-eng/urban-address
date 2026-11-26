# POS Hardware & Peripheral Integration Specification

## 1. Peripheral Connectivity
- **Barcode Scanners**: 1D/2D USB HID scanners (Plug-and-play). Configured to suffix with "Enter".
- **Magnetic Card Readers (MSR)**: 3-Track USB HID keyboard emulators. Used for loyalty and staff identification.
- **Receipt Printers**: 80mm Thermal (ESC/POS) via USB/Ethernet.
- **Cash Drawers**: Standard RJ11 connection to receipt printer for automated "pulse" triggers.

## 2. Magnetic Card Reader (MSR) Configuration
To ensure seamless integration with the Business OS, magnetic readers should be calibrated with the following settings:
- **Interface**: USB HID Keyboard Mode.
- **Track Data**: Enable Track 1 and Track 2 output.
- **Sentinels**: 
  - Track 1: Start `%`, End `?`
  - Track 2: Start `;`, End `?`
- **Suffix**: Must be set to `ENTER` (`\r` or `\n`) to trigger the internal `useCardReader` state submission.

## 3. Workflow Identification
1. **Customer Swipe**: Swiping a loyalty card at any POS terminal instantly queries the Firestore `users` registry.
2. **Session Linking**: If a match is found, the transaction is automatically linked to that member's loyalty profile for points accrual.
3. **Staff Swipe**: (Future Module) Allows for instant role switching or high-risk action authorization without manual PIN entry.

## 4. Payment Integration (Paystack)
- **Workflow**:
  1. POS initiates transaction.
  2. Paystack checkout generated via `react-paystack` secure modal.
  3. Real-time callback updates Firestore `Order` status to `PAID`.
  4. Thermal receipt auto-prints on success.

---
*URBAN EXPRESS Engineering | Hardware Integration Layer*
