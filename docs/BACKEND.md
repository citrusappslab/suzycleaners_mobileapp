# Supabase backend

The app works with two data adapters behind one contract, `Backend`, defined in
[`src/services/backend/types.ts`](../src/services/backend/types.ts):

| Adapter | When it's used | Data lives |
|---------|----------------|------------|
| `SupabaseBackend` | `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set (already in `.env`) | Your Supabase project, shared by every phone |
| `LocalBackend` | No Supabase keys, or `EXPO_PUBLIC_BACKEND=local` | On the device only (demo) |

No screen code changes between the two.

## Set up Supabase (about 10 minutes)

1. **Create a project** at [supabase.com](https://supabase.com). Pick the
   US West region for Burbank.

2. **Create the database.** Open **SQL Editor** and run these two files in
   order:
   1. [`supabase/migrations/20261008000000_init.sql`](../supabase/migrations/20261008000000_init.sql)
      creates the tables, security rules, server functions, push trigger and
      realtime.
   2. [`supabase/migrations/20261008000100_seed_catalog.sql`](../supabase/migrations/20261008000100_seed_catalog.sql)
      adds the services, prices, hours, locations and notification messages.

   If you use the Supabase CLI instead, run `supabase link` and then
   `supabase db push`.

3. **Create the staff login.** Go to **Authentication → Users → Add user**.
   - Email: `admin@suzyscleaners.com`
   - Password: your choice. Use a stronger one than the demo password.
   - Turn on **Auto confirm user**.

   Then run [`supabase/promote_admin.sql`](../supabase/promote_admin.sql) in
   the SQL Editor. This is the only way to make someone an admin. The app can
   never grant it.

4. **Choose how customers sign up.** Go to **Authentication → Sign In /
   Providers → Email**.
   - If **Confirm email** is on (recommended), new customers get a link and
     the app asks them to confirm before signing in.
   - If it's off, customers are signed in immediately after sign-up.

5. **Connect the app.** Already done: `.env` holds the project URL
   (`https://lhirannrwxcvqojuhrob.supabase.co`) and the **publishable** key,
   and Expo loads it automatically, including in EAS builds.
   - After changing `.env`, restart with `npx expo start --clear` (Expo
     bakes these values in at build time).
   - To point a single machine at another project, put overrides in
     `.env.local` (git-ignored).
   - Never put the secret / `service_role` key in the app.

6. **Push notifications.**
   1. Run `npx eas-cli init` so `extra.eas.projectId` is set in `app.json`.
   2. Install a development or production build.

   When a customer allows notifications, their Expo push token is saved to
   `profiles.push_token`. The database sends the push itself: the
   `push_notification` trigger calls Expo's push API through `pg_net` for
   every new notification row. No server code or secrets are needed.

## How security works

- **Row-level security** is on for every table:
  - Customers can only read their own profile, orders, messages and
    notifications.
  - Services and settings are public to read and admin-only to change.
- **Writes go through server functions.** Customers can't insert or update
  orders, messages or notifications directly. They call `SECURITY DEFINER`
  functions that check the caller's role first.

  | Function | Who | What the server enforces |
  |----------|-----|--------------------------|
  | `create_order` | customer | Recomputes prices from `services` (client prices are ignored), enforces the minimum order, valid time window, future date and service radius (from address coordinates) |
  | `cancel_my_order` | customer | Own order, only before pickup |
  | `send_my_message` | customer | Own thread, own orders only |
  | `admin_update_order` | admin | Status and history, final total, notification and message to the customer (which triggers the push) |
  | `admin_send_message`, `admin_mark_conversation_read`, `admin_list_customers`, `admin_list_conversations` | admin | `require_admin()` |
- **Roles:**
  - New accounts are always `customer`; any role in sign-up data is ignored.
  - A trigger stops anyone except an admin or the SQL editor from changing
    `role` or `email`.
  - The staff screen signs out any non-admin and shows the same error as a
    wrong password, so neither login screen reveals which emails exist.
- **Realtime:**
  - `orders`, `messages`, `notifications`, `services`, `settings` and
    `profiles` are published to Supabase Realtime, and the app refreshes
    on every change.
  - Realtime respects row-level security, so customers only receive their
    own changes.

Run `npm run test:db` to re-run the migration test against Postgres (PGlite), with stand-ins for
Supabase's `auth`, `pg_net` and roles. The tests covered:
- price tampering
- the minimum order, radius, time window and date checks
- customer-to-customer isolation
- blocked direct writes
- admin-only functions
- self-promotion attempts
- an admin status update reaching the customer
- the push trigger firing

## Going further

- **Payments:**
  - Add `payments.createIntent(orderId)` to the `Backend` contract.
  - Implement it with a Supabase Edge Function and Stripe
    (`@stripe/stripe-react-native` in the app).
  - Charge `final_total` once staff set it.
- **Address autocomplete:**
  - Swap `locateAddress` in `src/services/serviceArea.ts` for Google Places
    or Mapbox.
  - The coordinates already flow to `create_order`, which re-checks the
    radius on the server.
- **Sample data:** the demo's sample customers and orders are only in the
  local adapter. A live Supabase project starts clean, with just the catalog
  and settings.
