# Mobile money payment gateway setup

This application uses server-side integrations only. Never place provider secrets in `NEXT_PUBLIC_*` variables or in browser code.

## Safaricom Daraja (M-Pesa STK Push)

Create an application in the [Daraja Developer Portal](https://developer.safaricom.co.ke/) and enable Lipa Na M-Pesa Online.

Configure these Vercel environment variables:

- `MPESA_ENV=sandbox` for testing, or `production` after Safaricom approval
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL=https://YOUR_PUBLIC_DOMAIN/api/payments/mpesa/callback` (optional; the application builds this URL from `APP_BASE_URL` if omitted)
- `APP_BASE_URL=https://YOUR_PUBLIC_DOMAIN` (used to construct the callback URL)

Customer checkout and all three cashier POS stations (Store, Lounge and Carwash) support STK Push to a Kenyan mobile number. POS orders remain pending until the callback is matched to the stored CheckoutRequestID and independently checked against Daraja's STK Push Query API. Only then are inventory, carwash job state, receipt processing and Telegram sale notification finalized. The POS polls the authenticated order status endpoint while awaiting the callback.

## Airtel Money collections (Kenya)

Register an application at the [Airtel Africa Developer Portal](https://developers.airtel.africa/developer), select Kenya, add the Collections product, and complete Airtel's required onboarding and production approval.

Configure:

- `AIRTEL_ENV=sandbox` for UAT, or `production` after Airtel approval
- `AIRTEL_CLIENT_ID`
- `AIRTEL_CLIENT_SECRET`
- `AIRTEL_CALLBACK_TOKEN` (generate a long random secret; keep it server-only)

Set the Airtel collection callback URL in the Airtel portal to:

`https://YOUR_PUBLIC_DOMAIN/api/payments/airtel/callback?token=YOUR_AIRTEL_CALLBACK_TOKEN`

The callback token in the URL must exactly match `AIRTEL_CALLBACK_TOKEN`. The callback handler then queries Airtel's transaction endpoint and checks the transaction status and amount before marking the order paid. Confirm the callback and transaction-status endpoint contract shown in your Kenya Airtel application before production go-live; Airtel's portal is the authoritative source for the exact product version enabled for your account.

## Payment behavior and safety

- Customer Firebase ID tokens are verified server-side before a payment can be initiated.
- The order must belong to the authenticated customer and be awaiting payment.
- Amounts are read from the stored order; the browser cannot override the charge amount.
- Kenyan phone numbers are normalized to international format.
- Provider credentials remain server-side.
- Orders remain pending until a provider callback is verified.
- Duplicate successful callbacks are idempotent and inventory is synchronized in the same Firestore transaction as the paid status.
- Cash on delivery remains a separate fulfilment-time payment method. Visa card processing is not included in this Daraja/Airtel integration.

## Test sequence

1. Add the environment variables to Vercel Preview first.
2. Use Daraja sandbox credentials and Airtel UAT credentials.
3. Configure both callback URLs to the deployed Preview domain.
4. Test successful, cancelled, insufficient-funds and delayed callbacks.
5. Confirm orders remain pending for unverified or failed transactions.
6. Only switch each provider to production after the provider approves the merchant account and supplies production credentials.

Do not test production payments with real customers until callback delivery and provider-side status verification have been confirmed end to end.


## Maps and location search

Branch, delivery and pickup location selection uses Leaflet with OpenStreetMap tiles. Forward and reverse geocoding is routed through `/api/maps/geocode`, which uses Nominatim with an application-identifying User-Agent and stores successful results in the Firestore `maps_geocode_cache` collection. Coordinates and saved Google Maps URLs remain part of the branch and delivery records. Browser geolocation requires the user's explicit device permission.
