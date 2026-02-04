# Testing Stripe (sandbox / test mode)

## 0. Test the Boost flow with a mock user

To try the full boost flow (select post → Boost → Payment → success) without a real Stripe charge:

1. **Get test credentials**  
   With the Laravel backend running, open:  
   **http://localhost:8000/api/dev/boost-test-user**  
   You’ll get JSON with `email` and `password`.

2. **Log in**  
   In the app, go to **Login** and sign in with:
   - **Email:** `boosttest@example.com`
   - **Password:** `password123`  
   (Or use the email/password from the JSON if you changed them.)

3. **Run the boost flow**  
   - Open the **Boost** tab.  
   - You should see one post: “This is a test post – use it to try the Boost flow!”  
   - Tap **Boost** on that post → choose a tier (Local / Regional / National) → **Continue to Payment**.  
   - On the payment page, fill the card form (any values; it’s mock) and tap **Pay**.  
   - After the short delay you should see “Payment complete” and the post marked as boosted.

Payment is still **mock** (no Stripe charge). Use this to confirm the flow; use the sections below to confirm Stripe keys and sandbox.

---

## 1. Current state

- **Payment page**: Still uses a **mock** flow (fake card form + 2-second delay). No real charge is made; boost is activated in the app only.
- **Stripe keys**: Loaded in the app (frontend publishable key, backend secret key). Ready for when you wire real Stripe.

## 2. Check that your sandbox keys are loaded

**Option A – Backend (Laravel)**

1. Start the Laravel backend: `cd laravel-backend && php artisan serve`
2. Open in browser or with curl:
   ```
   http://localhost:8000/api/boost/stripe-status
   ```
3. You should see JSON like:
   ```json
   {
     "configured": true,
     "mode": "test",
     "publishable_key_set": true,
     "secret_key_set": true,
     "message": "Stripe test (sandbox) keys are loaded. Use test cards when you add real payments."
   }
   ```
   If `configured` is `false`, add `STRIPE_KEY` and `STRIPE_SECRET` to `laravel-backend/.env` (test keys from Stripe Dashboard).

**Option B – Stripe Dashboard**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Turn **Test mode** ON (toggle top-right). You should see **Test mode** and keys starting with `pk_test_` and `sk_test_`.
3. Developers → API keys: copy **Publishable key** and **Secret key** and match them with your `.env` (root for `VITE_STRIPE_PUBLISHABLE_KEY`, backend for `STRIPE_KEY` / `STRIPE_SECRET`).

## 3. How you know the sandbox is working

- **Keys loaded**: `GET /api/boost/stripe-status` returns `"configured": true` and `"mode": "test"`.
- **Dashboard**: In Test mode, any test payment you make later will show under **Payments** and **Balance** will stay **0** (no real money).
- **When you add real Stripe payments**: Use [Stripe test card numbers](https://docs.stripe.com/testing#cards), e.g.:
  - **4242 4242 4242 4242** – succeeds
  - **4000 0000 0000 0002** – declined
  - Use any future expiry (e.g. 12/34) and any 3-digit CVC.

## 4. Next step: real Stripe payments

To charge cards for real (in test mode), follow **STRIPE_BOOST_INTEGRATION.md**: backend creates a PaymentIntent, frontend uses Stripe.js (e.g. Payment Element), then you confirm and activate the boost. Until then, the in-app “payment” is mock-only and does not hit Stripe.
