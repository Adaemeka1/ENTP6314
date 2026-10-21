# NemaGo app (MVP)

The real NemaGo app: Next.js + Supabase Auth. Right now it has sign-in only
(email + password, or Google). The old clickable demo is `../index.html` and
is separate.

## What's here

| Page | What it does |
|---|---|
| `/login` | Sign in with Google or email + password |
| `/signup` | Create an account, choose driver or mechanic |
| `/forgot-password`, `/reset-password` | Reset a forgotten password by email |
| `/choose-role` | Google users pick driver or mechanic after their first sign-in |
| `/driver` | Driver home (placeholder until F1) |
| `/mechanic` | "Verification pending" until staff approve the mechanic (F7) |

Anyone who isn't signed in gets sent to `/login` (see `middleware.ts`).

## One-time setup

You need to do these steps yourself in your own accounts.

### 1. Create a Supabase project

1. Go to https://supabase.com, sign in, and click **New project**.
2. When it's ready, open **SQL Editor -> New query**, paste all of
   `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings -> API** and copy the **Project URL** and the
   **anon public** key.
4. In this folder, copy `.env.example` to `.env.local` and paste them in.

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

## Approving a mechanic (until F7 exists)

In Supabase, open **Table Editor -> profiles**, find the mechanic, and set
`mechanic_verified` to `true`. Users can't change this themselves.
