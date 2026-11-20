SERENE TOUCH — PAYMENT ENABLEMENT PACKAGE

Included:
- index.html (fixed phone validation, COD, static UPI QR full payment, Razorpay checkout client)
- razorpay-qr.png (the exact QR image supplied in the conversation)
- supabase-booking-payments-migration.sql
- Supabase Edge Functions:
  - create-razorpay-order
  - verify-razorpay-payment
  - submit-upi-reference

IMPORTANT RECIPIENT NOTICE:
The supplied static QR decodes to:
Payee: VIRJUL KUMAR
UPI ID: virjulkumar638597.rzp@rxairtel
Payments made by scanning this QR go to that UPI recipient. Use it on the client's website ONLY if the client has explicitly authorized this recipient/account to collect the client's customer payments. If not, replace the QR with the client's business-owned Razorpay QR.

UPI QR:
- This is a static QR and does not include the booking amount.
- The page displays the exact service total and creates a UPI intent link with the amount prefilled for supported apps.
- For scan-from-another-device, customer must manually enter the exact amount in their UPI app.
- UPI payment is NOT auto-verified by the QR. Customer submits UTR; business must verify in its Razorpay/bank account before confirming the booking.

RAZORPAY CHECKOUT:
Razorpay integration follows the required server-side order creation and server-side signature/payment status verification flow. Do not mark a payment as paid based only on the browser callback.

SETUP:
1. Run the initial SQL from earlier (if not already run).
2. Run supabase-booking-payments-migration.sql in Supabase SQL Editor.
3. Deploy the three Edge Functions using Supabase CLI. The included supabase/config.toml sets verify_jwt=false because these public booking functions are called before customer login; the functions validate booking references and use service-role access only server-side. Do not expose service-role credentials.
4. From the project folder, deploy each function (or deploy all with Supabase CLI): supabase functions deploy create-razorpay-order --no-verify-jwt; supabase functions deploy verify-razorpay-payment --no-verify-jwt; supabase functions deploy submit-upi-reference --no-verify-jwt. Then set Edge Function secrets:
   RAZORPAY_KEY_ID = Razorpay Key ID
   RAZORPAY_KEY_SECRET = Razorpay Key Secret
   Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Edge Functions.
5. Enable and configure Razorpay account for live payments. Test with test keys first.
6. Upload BOTH index.html and razorpay-qr.png to the root of the GitHub Pages repository.
7. Verify that Supabase Data API and Edge Functions are enabled.
8. Test with a small test-mode payment before live launch.

MOBILE NUMBER FIX:
The previous JS used double-escaped regex characters. The updated code accepts a 10-digit Indian number or 91 + 10 digits, and strips spaces, brackets and hyphens.

SECURITY:
- Never put Razorpay Key Secret or Supabase service_role key in HTML/GitHub.
- Publishable key in the browser is expected; Row Level Security must remain enabled.
- UPI UTR supplied by a customer is not proof of payment.
- Do not deliver services until Razorpay payment is captured/verified or UPI receipt is independently checked.
- Admin access and secure booking management should be implemented separately; public customers cannot read bookings.

PUBLIC DATABASE ACCESS NOTE:
The browser inserts booking requests without selecting/reading rows. Edge Functions use the booking reference to look up rows with the server-only service role. No public SELECT policy is required.
