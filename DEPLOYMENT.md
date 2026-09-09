# Deploy StudyDesk without Git commands

StudyDesk is a Vite-built static React frontend backed by Supabase. There is no Express server to deploy or maintain.

## 1. Create the free Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project.
2. Choose the region closest to the library and save the database password somewhere private.
3. Open **SQL Editor**, create a query, and run the files in `supabase/migrations/` in number order. Existing projects should run every migration they have not applied yet, including `003_profile_photos.sql`.
4. Open **Project Settings → API** and copy:
   - Project URL
   - Publishable key (a legacy `anon` key also works)
5. Keep those two values ready for the Cloudflare build settings. The publishable key is designed for browser use. Never paste the `service_role` or secret key into this project.

The optional GitHub selector in Supabase is not required for StudyDesk. Supabase provides authentication and the database; Cloudflare Pages connects to GitHub and deploys the website. The repository may be public because the Project URL and publishable key are browser-safe—database access is enforced by Row Level Security.

## 2. Check authentication settings

1. In Supabase, open **Authentication → URL Configuration**.
2. During local testing, add `http://localhost:3000/**` to **Redirect URLs**.
3. Keep email/password authentication enabled.
4. Email confirmation can remain enabled. New owners and invited administrators will confirm their email before their first login.
5. In **Authentication → Emails → SMTP Settings**, configure a custom SMTP provider before inviting real users. Supabase's built-in sender is intended for testing and may only deliver to project-team addresses.

After Cloudflare gives you the final `https://...pages.dev` address, return here and set it as the **Site URL** and add it to **Redirect URLs**.

## 3. Upload once through the GitHub website

1. Open the existing [shantanu1258/studydesk repository](https://github.com/shantanu1258/studydesk).
2. Choose **uploading an existing file** on the empty repository page.
3. In Finder, press **Command + Shift + .** if needed so `.gitignore` and `.env.example` are visible.
4. Drag the contents of the `study-library-manager` folder into the upload area. Upload the contents, not the outer folder itself. Do not upload `node_modules`, `dist`, or `.env.local`.
5. Use a message such as `Add StudyDesk application` and select **Commit changes**.

This browser upload creates the one initial repository version without any Git commands.

## 4. Publish with Cloudflare Pages

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Open **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Connect GitHub and select `shantanu1258/studydesk`.
4. Use these settings:
   - Production branch: `main`
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave blank
5. Add these build environment variables using the values from Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
6. Select **Save and Deploy**.

Cloudflare will provide a free `pages.dev` address. Opening that address should show StudyDesk.

## 5. Final live check

1. Update the Supabase Site URL and Redirect URLs with the Cloudflare address.
2. Create a new account from the StudyDesk signup screen.
3. Confirm the email if prompted, then log in.
4. Add one member, record attendance, refresh the page, and confirm the records remain.
5. In **Settings → Library team**, create an invitation code. Use another email address to join and confirm both accounts see the same library.
6. Confirm the founding owner is labelled protected and cannot be removed.
7. Log out and confirm the workspace is no longer visible.
8. Select **Forgot password?**, open the emailed reset link, choose a new password, and log in with it.
9. On Android, open the site in Chrome and choose **Install app** when prompted.
10. On iPhone or iPad, open the site in Safari, tap **Share → Add to Home Screen → Add**.

The installed icon launches the same Cloudflare website in a standalone app window. It does not create a separate copy of your database: every device continues to use the same Supabase project. Static screens can open during a brief outage, but signing in and reading or saving live records still require internet access.

## Updating later without Git commands

For a small change, open the file on GitHub and use the pencil icon. For a larger update, use **Add file → Upload files** and replace the changed files. Each GitHub website change automatically starts a new Cloudflare deployment.
