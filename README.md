# Question Bank

A multiple-choice practice site: students pick weeks, answer questions, and get instant marking with explanations. Admins manage everything from inside the site.

**Stack:** Vite + React + Tailwind (front end), Supabase (login + database), Cloudflare Pages (hosting).

## Where everything lives (keep this updated)

| Thing | Where | Owner account |
|---|---|---|
| Code | GitHub repo | (fill in) |
| Database + login | Supabase project "Question Bank" | (fill in) |
| Website hosting | Cloudflare Pages | (fill in) |
| Domain (optional) | (registrar) | (fill in) |

Use a shared society email for all of these, not a personal one.

## Deploy

1. Create a GitHub repo and upload this folder's contents (do not upload `node_modules` or `dist`).
2. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, pick the repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables (Settings → Variables), copied from `.env.example`:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
3. Deploy. You get a `*.pages.dev` address. Add a custom domain later under the project's **Custom domains** tab.
4. In Supabase: **Authentication → URL Configuration**, set **Site URL** to your live address (so confirmation emails link to the right place).

The anon/publishable key is designed to be public. Security comes from the database's row-level security rules, not from hiding this key. Never put the `service_role` key in this project.

## Make the first admin

1. Sign up on the live site with your university email.
2. In Supabase: **SQL Editor**, run (with your email):

```sql
update public.profiles set is_admin = true where email = 'you@soton.ac.uk';
```

3. Refresh the site. An **Admin** section appears. From then on, use **Admins** to promote other committee members, no SQL needed.

## Day-to-day (all inside the site, as an admin)

- **Structure:** add years, modules and weeks; lock or unlock them. New modules and weeks start locked, so unlock when ready.
- **Questions:** pick a week, then add or edit questions, or import a CSV. Use "Download CSV template" for the format (columns: `stem, option_a … option_e, correct, explanation`, where `correct` is a letter).
- **Admins:** promote or demote people, and control which email domains can sign up (currently `soton.ac.uk` only; empty list = open sign-up).
- Delete the sample "DEMO" module once you have real content.

## Handover checklist (each committee change)

- [ ] New committee members added as admins; leavers removed
- [ ] Shared email still has access to GitHub, Supabase, Cloudflare and the domain registrar
- [ ] Domain renewal date noted
- [ ] Export the questions (Supabase → Table Editor → `questions` → Export) as a backup
- [ ] Check Supabase usage (free plan: about 500 MB database, 5 GB egress; projects pause after about a week of inactivity, and there are no automatic backups)

## Known limits

- Multiple-choice only. Photo-station questions are not built yet (the plan is image storage on Cloudflare R2 to avoid Supabase egress limits).
- Correct answers are sent to the browser so marking can be instant, so a determined student could read them in developer tools. Fine for practice; do not use it for assessed work.
- Supabase's built-in email sending is rate-limited. For large sign-up waves, configure your own SMTP provider under Authentication → SMTP Settings.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```
