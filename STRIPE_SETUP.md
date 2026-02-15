# Stripe Boost Payment Setup (Sandbox)

Use these steps to enable Stripe payments for the Boost feature in sandbox/test mode.

## 1. Get Stripe Test Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle **Test mode** (top right) to ON
3. Go to **Developers → API keys**
4. Copy:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## 2. Backend Configuration

Add to `laravel-backend/.env`:

```env
STRIPE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET=sk_test_your_secret_key_here
```

(Alternatively: `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are also supported.)

## 3. Frontend Configuration

Add to your project root `.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

Restart the dev server after changing `.env` so Vite picks up the new variable.

## 4. Run Migration

```bash
cd laravel-backend
php artisan migrate
```

This creates the `boosts` table.

## 5. Verify Setup

1. Start the backend: `cd laravel-backend && php artisan serve`
2. Start the frontend: `npm run dev`
3. Open `http://localhost:8000/api/boost/stripe-status` – you should see `configured: true` and `mode: test`

## 6. Test Account

Use a real account that exists in your Laravel database. For a quick test user:

```bash
# Get test credentials
curl http://localhost:8000/api/dev/boost-test-user
```

Log in with the returned email/password, then go to Boost and boost the test post.

## 7. Test Cards (Sandbox)

| Card number      | Scenario              |
|------------------|------------------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 3220 | 3D Secure required   |
| 4000 0000 0000 9995 | Declined             |

Use any future expiry date (e.g. 12/34) and any 3-digit CVC.

**Note:** The "Bob@Ireland" mock user may not work with real Stripe payments since it uses a fake user ID. Log in with a real account (e.g. from `/api/dev/boost-test-user`) to test the full flow.

## Flow Summary

1. User selects Boost tier → Payment page
2. Stripe Payment Element loads
3. User enters card → Stripe processes payment
4. Stripe redirects to `/payment-success?payment_intent=pi_xxx&redirect_status=succeeded`
5. Backend verifies PaymentIntent and creates boost (persisted to DB)
6. Boosted posts appear in the relevant feed for 6 hours
