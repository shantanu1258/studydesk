# StudyDesk

StudyDesk is a lightweight management app for Indian self-study libraries, paid reading rooms, and study halls. It tracks seat allocation by shift, members, monthly fees, renewals, and long-term records.

## Features

- Supabase email/password accounts for the Core admin and additional admins
- Secure email password recovery with a dedicated new-password screen
- In-app profile, profile-photo, and password management
- One-time invitation codes for joining the same private library
- A protected Core admin; additional admins have equal day-to-day application access
- PostgreSQL storage protected by Row Level Security
- Morning, Afternoon, Evening, Full Day, and repeatable numbered Hour plans
- Member admission, overlap-aware seat assignment, editable plan dates, and renewals
- Unique phone-number identity with guided active-member lookup and inactive-member reactivation
- Deactivation and reactivation with complete member and payment history preserved
- Per-member fee history with payment count, totals, and direct corrections
- Persistent, shift-aware demo seats shared by every admin
- Configurable advance or later fee collection, including warned admission without payment
- Monthly, yearly, custom-range, and lifetime fee reporting with CSV export
- Optional manual attendance, disabled by default
- Configurable seat sections with continuous ranges such as A-01–A-20 and B-21–B-40
- Seat count and library colours during setup, with editable library-wide theming
- Payment corrections at any age with an extra confirmation for older records; deletion remains limited to four days
- JSON backup and restore
- Local demo mode with sample records
- Responsive desktop and mobile layout
- Installable web app for iPhone, iPad, and Android
- Cached application shell for opening the interface during a temporary connection outage

## Architecture

The frontend is a Vite-powered React 18 application written in TypeScript and styled with Tailwind CSS. Supabase provides authentication and PostgreSQL storage, so there is no Express server to run.

- `src/features/` — feature screens and dialogs for auth, dashboard, members, fees, attendance, and settings
- `src/components/` — reusable layout, form, modal, toast, icon, PWA, and seat components
- `src/controllers/` — React state and application actions; UI components do not call the database
- `src/repositories/` — authentication, team, local-demo, and workspace data operations
- `src/infrastructure/` — the Supabase client and PWA registration boundaries
- `src/types/` — shared domain and application types
- `src/utils/` — pure date, member, shift, seat, and theme rules
- `src/config/environment.ts` — reads public Supabase configuration from Vite variables
- `src/pwa/manifest.ts` — iOS and Android installation metadata
- `public/` — SD brand mark, app icons, social preview, and Cloudflare response headers
- `assets/` — editable source artwork that is not shipped to visitors
- `supabase/migrations/` — database schema, triggers, grants, and access policies
- `tests/` — changed-record persistence tests
- `vite.config.ts` — optimized build and installable-app generation

## Run locally

Install the managed packages once, then start Vite:

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000` and choose **Use demo**. Demo records remain only in that browser.

On a compatible phone, use the **Install app** button. Android can show a native install prompt; iPhone and iPad display the Safari Home Screen steps. Installation on the live site requires HTTPS, which Cloudflare Pages provides automatically.

Run `npm run check` to verify the application and create a production build.

## Connect real accounts and cloud data

1. Create a Supabase project.
2. Run the files in `supabase/migrations/` in number order in its SQL Editor. Existing projects should run every migration they have not applied yet, including `004_demo_seats_and_fee_controls.sql`.
3. Copy `.env.example` to `.env.local` and add the Project URL and publishable key.
4. Add `http://localhost:3000/**` to the Supabase authentication Redirect URLs.
5. Before serving real users, configure a custom SMTP provider in **Authentication → Emails → SMTP Settings** so confirmation and password-reset emails can be delivered reliably.
6. Reload StudyDesk and create the Core admin account.
7. To add another administrator, create a one-time code in **Settings → Library team**. They choose **Join with code** during signup.

Only the public publishable key belongs in the frontend. Never add a Supabase `service_role` or secret key.

## Deploy

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for a browser-only GitHub upload and free Cloudflare Pages deployment. No Git commands are required.

## Security model

Every application table has Row Level Security enabled. The browser signs requests with the current Supabase session, and database policies limit access to users attached to that library. Team changes go through protected database functions; only the Core admin can remove another admin, and the Core admin cannot be removed. Signed-out requests receive no library data.
