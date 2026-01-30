# Stripe integration sketch – Boost payments

This doc sketches how to replace the mock card flow with **Stripe** for boost payments. Your current flow (BoostSelectionModal → PaymentPage → activateBoost → redirect with Sponsored label) stays; only the payment step becomes real.

---

## 1. High-level flow

```
User selects boost (local/regional/national) → navigates to /payment with { post, feedType, price }
→ Frontend calls backend: POST /api/boost/create-payment-intent { postId, feedType }
→ Backend creates Stripe PaymentIntent (amount = price for that feedType), returns clientSecret
→ Frontend: Stripe.js confirms payment with clientSecret (card UI)
→ On success:
   Option A (recommended): Frontend calls POST /api/boost/confirm { paymentIntentId } → backend confirms with Stripe, then activates boost and returns success
   Option B: Backend activates boost in a Stripe webhook (payment_intent.succeeded)
→ Frontend shows success, navigates to /feed or /boost with { boostSuccess, postId, feedType } (unchanged)
→ Feed applies Sponsored label (existing logic)
```

---

## 2. Stripe setup

- **Dashboard**: https://dashboard.stripe.com  
- **API keys**: Developers → API keys → Publishable key (frontend) and Secret key (backend only).
- **Products/Prices** (optional but good for reporting): Create a Product “Post boost” and three Prices (e.g. 4.99 EUR local, 6.99 EUR regional, 9.99 EUR national). You can also create PaymentIntents with ad‑hoc amounts from your existing `feedType` → price mapping (see `BoostSelectionModal`: 4.99 / 6.99 / 9.99).

---

## 3. Backend (Laravel)

### 3.1 Install and config

```bash
cd laravel-backend
composer require stripe/stripe-php
```

**.env** (never commit secret key):

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # optional, for Option B
STRIPE_PUBLISHABLE_KEY=pk_test_... # optional, if backend ever needs to expose it
```

**config/services.php**:

```php
'stripe' => [
    'secret' => env('STRIPE_SECRET_KEY'),
    'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    'currency' => 'eur',
],
```

### 3.2 Boost price mapping

Keep prices in sync with the frontend (e.g. `BoostSelectionModal`):

- `local` → 4.99 EUR  
- `regional` → 6.99 EUR  
- `national` → 9.99 EUR  

Store in config or a small helper so backend and frontend use the same values.

### 3.3 New API routes (auth required)

In **routes/api.php** (inside `auth:sanctum` group):

```php
Route::prefix('boost')->group(function () {
    Route::post('/create-payment-intent', [BoostPaymentController::class, 'createPaymentIntent']);
    Route::post('/confirm', [BoostPaymentController::class, 'confirm']);
});
```

### 3.4 Controller: create PaymentIntent

**app/Http/Controllers/Api/BoostPaymentController.php** (new):

- **createPaymentIntent**
  - Input: `postId`, `feedType` (local|regional|national).
  - Auth: ensure `auth()->user()` owns the post (e.g. post’s `user_id` or `user_handle` = current user).
  - Validate post exists and is not a reclip (or whatever your rule is).
  - Map `feedType` → amount in cents (e.g. 499, 699, 999).
  - `\Stripe\Stripe::setApiKey(config('services.stripe.secret'));`
  - `$intent = \Stripe\PaymentIntent::create([ 'amount' => $amountCents, 'currency' => 'eur', 'metadata' => [ 'post_id' => $postId, 'feed_type' => $feedType, 'user_id' => auth()->id() ] ]);`
  - Return `{ clientSecret: $intent->client_secret, paymentIntentId: $intent->id }` (and optionally `amount`, `currency` for UI).

This way the backend is the single source of truth for amount and who can boost which post.

### 3.5 Controller: confirm (Option A – recommended first)

- **confirm**
  - Input: `paymentIntentId` (and optionally `postId` for idempotency).
  - Auth: required.
  - Retrieve PaymentIntent with Stripe API; check `status === 'succeeded'` and that `metadata.user_id` matches current user (and optionally `metadata.post_id`).
  - If not yet succeeded, you can return 400 and ask frontend to wait or poll.
  - Then:
    - Persist the boost (e.g. new table `boost_payments`: `user_id`, `post_id`, `feed_type`, `stripe_payment_intent_id`, `amount`, `expires_at` = now + 6 hours, etc.).
    - Call your existing “activate boost” logic (e.g. a service that sets the post as boosted for 6 hours for that feed type).
  - Return e.g. `{ success: true, postId, feedType }`.

Frontend will then call `activateBoost(post.id, user.id, feedType, price)` locally (or you can remove local activateBoost and rely 100% on backend). Easiest is to keep the existing frontend `activateBoost()` call after backend confirm success, so the Sponsored label and feed injection keep working as today.

### 3.6 Webhook (Option B – optional)

If you want to activate boost only after Stripe confirms payment (e.g. to handle async 3DS):

- **Route**: e.g. `POST /api/webhooks/stripe` (no auth; verify with `Stripe::Webhook::constructEvent` using `STRIPE_WEBHOOK_SECRET`).
- On `payment_intent.succeeded`, read `metadata.post_id`, `metadata.feed_type`, `metadata.user_id`, then persist boost and run your activate-boost logic.
- Frontend: after `confirmCardPayment` (or equivalent) succeeds, either call your `/api/boost/confirm` to activate immediately, or poll a “boost status” endpoint until the webhook has run. Option A avoids polling.

---

## 4. Frontend (Vite / React)

### 4.1 Env and Stripe.js

**.env** (or .env.local):

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Load Stripe only on PaymentPage (or in a small wrapper) so the key is only used when needed:

```ts
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
```

### 4.2 PaymentPage changes

- **Remove** the mock card form (card number, expiry, CVV) and the 2-second fake delay.
- **Add** either:
  - **Stripe Checkout** (redirect): create a Checkout Session on the backend, redirect to `session.url`, then redirect back to your success URL with `?session_id=...` and call backend to confirm and activate boost; or
  - **Payment Element** (embedded, recommended):  
    1. On mount, call `POST /api/boost/create-payment-intent` with `postId`, `feedType` (from `location.state`).  
    2. Receive `clientSecret`.  
    3. Render `<Elements stripe={stripePromise} options={{ clientSecret }}>` and `<PaymentElement />` (from `@stripe/react-stripe-js`).  
    4. On submit, call `stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.origin + '/payment/return', ... } })` or use `confirmPayment` without redirect and handle success in the same page.  
    5. On success, call `POST /api/boost/confirm` with `paymentIntentId` (from the PaymentIntent or from the redirect query).  
    6. Then run your existing success flow: e.g. `await activateBoost(post.id, user.id, feedType, price)` (if you still do boost activation on the client for the current session), then show SweetAlert and `navigate('/feed', { state: { boostSuccess: true, postId: post.id, feedType } })` (same as now).

Keep the same `location.state` shape (`post`, `feedType`, `price`) and the same redirect + state after success so the feed and Boost page continue to show the Sponsored label and “Boosted” state.

### 4.3 API client

Add two helpers (or use existing `apiRequest`):

- `createBoostPaymentIntent(postId: string, feedType: string)` → `POST /api/boost/create-payment-intent` with auth, returns `{ clientSecret, paymentIntentId }`.
- `confirmBoostPayment(paymentIntentId: string)` → `POST /api/boost/confirm` with auth, returns `{ success, postId, feedType }`.

Use the auth token (e.g. Bearer) you already use for Laravel so the backend can enforce “only post owner can create PaymentIntent / confirm”.

---

## 5. Security checklist

- **Secret key** only in Laravel `.env`; never in frontend or in git.
- **Amount** is set only on the backend from `feedType` (or from your Prices); frontend does not send amount for the PaymentIntent.
- **Post ownership** checked on both create-payment-intent and confirm (and in webhook via `metadata.user_id`).
- **Idempotency**: if the user double-clicks, either use Stripe idempotency keys on create PaymentIntent or make confirm idempotent (e.g. “boost already activated for this payment”).

---

## 6. Optional: store payments in DB

Table idea (migration):

- `user_id`, `post_id`, `feed_type`, `amount_cents`, `currency`
- `stripe_payment_intent_id` (unique)
- `paid_at`, `expires_at` (boost end time)
- Optional: `created_at`, `updated_at`

This gives you a record for support and for showing “Boosted until …” or history on the Boost page.

---

## 7. Summary

| Piece              | Responsibility |
|--------------------|----------------|
| **Stripe Dashboard** | Publishable + Secret keys; optional Products/Prices. |
| **Laravel**         | Create PaymentIntent (amount from feedType), optional confirm endpoint, optional webhook; never expose secret key. |
| **PaymentPage**     | Get clientSecret → Stripe Elements (or Checkout redirect) → on success call confirm (and/or wait for webhook) → then same success UI + `navigate` with `boostSuccess` / `postId` / `feedType`. |
| **Existing feed**   | No change: still uses `post.isBoosted` and `boostFeedType` and your current “apply boost after payment” logic. |

Once Stripe is wired, you can remove the mock card form and the fake delay and keep the rest of the boost UX (modal, payment page, success popup, Back to Newsfeed / Stay on Boost Page, Sponsored label) as is.
