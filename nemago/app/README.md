# NemaGo app (MVP)

The real NemaGo app: Next.js + Supabase. It has sign-in (email + password, or
Google), driver and mechanic database tables, a pretend payment screen, and a
Car Helper chat. The old clickable demo is `../index.html` and is separate.

## What's here

| Page | What it does |
|---|---|
| `/login` | Sign in with Google or email + password |
| `/signup` | Create an account, choose driver or mechanic |
| `/forgot-password`, `/reset-password` | Reset a forgotten password by email |
| `/choose-role` | Google users pick driver or mechanic after their first sign-in |
| `/driver` | Driver home (placeholder until F1) |
| `/driver/chat` | Car Helper: type what's wrong, get a plain-English answer |
| `/mechanic` | "Verification pending" until staff approve the mechanic (F7) |
| `/driver/request` | Driver confirms a dispatch and pays through Stripe Checkout, then watches the request update live |
| `/mechanic/jobs` | Verified mechanics see new PAID requests live, accept one (first to accept wins), and mark it complete to get paid |
| `/mechanic/payouts` | "Set Up Payouts": Stripe Express onboarding so a mechanic can be paid |
| `/mechanic/billing` | Pretend payment of the monthly platform subscription |

The Car Helper and the mechanic subscription screen are demos. The Car Helper
matches key words (`lib/diagnose.ts`) and is not a real AI. Driver payments and
mechanic payouts are real **Stripe test-mode** payments (Stripe Connect). The
prices and the service-fee percentage live in `lib/fees.ts` and are placeholders.
The Stripe and Supabase secret keys, the webhook and the API routes are listed in
`../CLAUDE.md`.

Anyone who isn't signed in gets sent to `/login` (see `middleware.ts`).

## One-time setup

You need to do these steps yourself in your own accounts.

### 1. Create a Supabase project

**Shortcut: one paste.** All the database files below can be installed in one go.
This copies them, in the right order, to your clipboard (run it from this folder),
then paste into **SQL Editor -> New query** and click **Run**:

```bash
(cd supabase && cat retire-old-dispatch.sql schema.sql drivers-and-mechanics.sql dispatch.sql payments.sql; echo "notify pgrst, 'reload schema';") | pbcopy
```

`retire-old-dispatch.sql` removes an older NemaGo dispatch design if one is in the
database (Supabase will ask you to confirm a "destructive operation"). It only
touches tables it recognizes as the old design, and it stops with an error if any
of them contain rows. Everything is safe to run again. The numbered steps below do
the same thing one file at a time.

1. Go to https://supabase.com, sign in, and click **New project**.
2. When it's ready, open **SQL Editor -> New query**, paste all of
   `supabase/schema.sql`, and click **Run**.
3. Do the same for the second file, `supabase/drivers-and-mechanics.sql`. It
   creates the `drivers` and `mechanics` tables (phone, certification,
   subscription, service area). Run it after `schema.sql`.
4. Do the same for the third file, `supabase/dispatch.sql`. It creates the
   dispatch requests, the rules for who can see them, and turns on Realtime.
5. Do the same for the fourth file, `supabase/payments.sql`. It adds the unpaid
   request state, the private payment records, and the server-only money
   functions. Run it after `dispatch.sql`.
6. Open **Project Settings -> API** and copy the **Project URL** and the
   **anon public** key.
7. In this folder, copy `.env.example` to `.env.local` and paste them in.

### 2. Set the redirect URLs

In Supabase, open **Authentication -> URL Configuration**:

- **Site URL:** `http://localhost:3000` for now (change it to your Vercel URL
  when you deploy).
- **Redirect URLs:** add `http://localhost:3000/auth/callback` (and later
  `https://<your-vercel-url>/auth/callback`).

### 3. Turn on Google sign-in

1. In https://console.cloud.google.com, create a project, then go to
   **APIs & Services -> OAuth consent screen** and fill it in (app name
   NemaGo, your email).
2. Go to **Credentials -> Create credentials -> OAuth client ID**, type
   **Web application**.
3. Under **Authorized redirect URIs**, add the callback URL Supabase shows
   you in **Authentication -> Sign In / Providers -> Google**
   (it looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
4. Copy the Google **Client ID** and **Client secret** into that same Supabase
   Google page and switch Google **on**. The secret stays in Supabase; it never
   goes in this repo.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Stripe setup (test mode)

You need a Stripe account with **Connect** turned on, a webhook pointing at
`<your-site>/api/stripe/webhook` (events `checkout.session.completed` and
`checkout.session.expired`), and these secrets set in Vercel and in
`.env.local`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Test card: 4242 4242 4242
4242, any future date, any 3-digit code.

## Trying the live dispatch flow

You need two accounts (one driver, one mechanic), signed in at the same time in
two separate browser windows. A normal window plus a private/incognito window
works, because they keep separate sign-ins. Approve the mechanic first (below)
and have them finish **Set Up Payouts**. Then the driver taps **Confirm
Dispatch**, pays with the test card, and the mechanic's **Job requests** screen
shows the paid request.

Screens update instantly through Supabase Realtime. As a safety net they also
re-check every 5 to 10 seconds, so they still work if Realtime is off. The small
dot at the top of each screen says which mode you are in.

## Approving a mechanic (until F7 exists)

In Supabase, open **Table Editor -> profiles**, find the mechanic, and set
`mechanic_verified` to `true`. Users can't change this themselves.
