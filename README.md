# Suzy's Cleaners: mobile app

A concierge garment-care app for **Suzy's Cleaners** in Burbank, CA (est. 1996).
It runs on iOS and Android from one Expo / React Native codebase.

## Features

**Customers**
- **Home:** branded hero, a **Schedule a Pickup** button, a live
  current-order card, trust badges, service tiles, Chamber Member
  recognition, and **Coming Soon: Pasadena & Northridge**.
- **Services:** Dry Cleaning, Garment Care, Luxury Shoe Cleaning, Tailoring &
  Alterations, and Pickup & Delivery, each with its own detail page.
- **Schedule a Pickup:**
  - Choose services and quantities.
  - Pick a pickup and a delivery address (saved to the profile).
  - Pick a date and time window, and add special instructions (500 characters).
  - See a live estimate. The **$50 minimum** is enforced.
  - The service radius is checked (default 20 miles, set by staff).
- **Orders:** live status tracker with Request Received → Pickup Confirmed →
  Driver on the Way → Picked Up → Cleaning in Progress → Ready for
  Pickup / Ready for Delivery → Out for Delivery → Completed, plus Cancelled.
- **Messages:** concierge chat with topic shortcuts (order, pickup, delivery,
  tailoring, shoes).
- **Notifications:** in-app banners, a notification inbox, and push-ready
  system notifications.
- **Account:** profile, saved addresses, notification settings, About Us,
  Contact Us (tap-to-call, email, directions, hours, locations).

**Staff (Admin)**
- **Hidden staff login:**
  - Long-press the version label at the bottom of **Account**, or open
    `suzyscleaners://staff-login`.
  - It never appears as a customer option.
  - It locks for one minute after 5 failed attempts.
- **Admin Dashboard:**
  - Counts for New, Scheduled, In Cleaning, Ready, Messages, Active,
    Completed and Cancelled.
  - Customer and order search.
  - Select an order, then use **Update & Notify Customer**.
- **Order detail:**
  - Customer name, phone, email, pickup and delivery addresses, requested
    date and time window, services, instructions, estimated and final total,
    status history.
  - **Update & Notify Customer** sends an editable message. Ready for Pickup
    sends "Great news! Your Suzy Cleaners order is ready for pickup."
- **Customers:** profiles, contact info, saved addresses, order history,
  message history.
- **Messages:** inbox with unread counts, conversation history, replies,
  quick replies, and custom messages to any customer.
- **Settings:**
  - Services, descriptions and pricing.
  - $50 minimum and service radius.
  - Time windows and business hours.
  - Current and Coming Soon locations.
  - The notification text for each status.
  - Business profile, and a demo-data reset.

**Role-based access:** sessions carry a role.
- Customers can't sign in through the staff screen, and staff can't sign in
  as customers.
- `/admin/*` routes redirect anyone who isn't an admin.
- With Supabase, the database enforces this: row-level security plus
  role-checked server functions (see [docs/BACKEND.md](docs/BACKEND.md)). The
  local demo adapter applies the same checks on the device.

## Data: Supabase or on-device demo

- **Supabase (production, the default):** `.env` points the app at the
  Suzy's Supabase project. Before first use, run the database setup in
  [docs/BACKEND.md](docs/BACKEND.md) (SQL migrations + staff login).
- **On-device demo:** set `EXPO_PUBLIC_BACKEND=local` in `.env.local` to use
  sample data stored on the phone, with the accounts below.

## Demo accounts

| Role     | Email                     | Password         |
|----------|---------------------------|------------------|
| Admin    | admin@suzyscleaners.com   | SuzyAdmin2026!   |
| Customer | demo@suzyscleaners.com    | Demo1234!        |

These work with Supabase once `supabase/setup.sql` has been run (see
[docs/BACKEND.md](docs/BACKEND.md)), and with the on-device demo. Customers
can also create their own account. Change the admin password and delete the
demo customer before launch.

> The demo backend stores data **on the device**. To try the full loop on one
> phone, book as the customer, sign out, sign in as staff, update the order,
> then sign back in as the customer. With Supabase, the customer and staff can
> use separate phones and updates arrive live.

## Run it

```bash
npm install
npx expo start          # press i for iOS simulator, a for Android, or scan with Expo Go
npm run typecheck
```

You need a development build (`npx expo run:ios|android` or
`npx eas-cli build --profile development`) for remote push notifications. Run
`npx eas-cli init` first so the EAS project id is filled in.

## Project structure

```
src/
  app/                    Expo Router screens
    (tabs)/               Customer tabs: Home, Services, Orders, Messages, Account
    schedule.tsx          Schedule a Pickup
    order/[id].tsx        Order status tracker
    service/[id].tsx      Service detail
    auth/                 Customer sign in / sign up
    staff-login.tsx       Hidden staff login
    admin/                Role-gated admin area (dashboard, orders, customers, chat, settings)
  components/             Reusable UI (ui/, brand/, orders/, chat/, admin/)
  config/                 Business defaults, order statuses + notification templates, demo creds
  hooks/                  Live data hooks (re-query on backend change events)
  providers/              Auth + notification/toast providers
  services/
    backend/              Backend contract, SupabaseBackend and LocalBackend adapters
    push.ts               Push registration, local + Expo push delivery
    serviceArea.ts        Distance / radius validation
  theme/                  Design tokens (colors, type, spacing, radius, shadows)
assets/brand, assets/services   Logo and service imagery
supabase/                 Database migrations (schema, security, functions, push trigger, seed)
docs/BACKEND.md           Supabase setup guide and security model
```

## Brand

- **Palette:** Suzy's navy and royal blue from the logo, a warm orange call
  to action, sunshine yellow from the approved mockups, plus cream, beige and
  muted gold for the luxury feel. Tokens live in `src/theme/index.ts`.
- **Fonts:** Playfair Display for headings, Inter for body text.

## Before launch

- **Contact details:** confirm the phone numbers **(747) 333-0034** and **(463) 583-0000**, the email
  and the **business hours**. They came from the Burbank Chamber listing, and
  hours are placeholders. Staff can edit all of them in Admin → Settings.
- **Images:** replace `assets/brand/logo.png` and `assets/services/*.jpg` with
  high-resolution originals (same file names). These were cropped from the
  design mockups.
- **Chamber badge:** swap the typographic Chamber mark in
  `src/components/brand/sections.tsx` for the official member badge if
  desired.
- **Backend:** run `supabase/setup.sql` in Supabase
  ([docs/BACKEND.md](docs/BACKEND.md)), then change the demo admin password
  and delete the demo customer.
