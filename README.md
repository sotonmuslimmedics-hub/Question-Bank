# MMS Question Bank

Vite + React + Tailwind front end, Supabase (auth, database, photo storage), deployed on Cloudflare Workers static assets.

## Roles

| Role | Can do |
| --- | --- |
| Student | Practise, read news |
| Student teacher | + write questions (saved as drafts), build slides from **their own** questions, log teaching, view topic tracker |
| Academic lead | + review/publish/move/delete any question, post news, edit topic tracker |
| Committee admin | + edit structure, roles, sign-up domains, imports, backups |

Roles are set in **People** (admin). The database enforces them (row level security), not just the menus.

## Structure

Sections form a tree of any depth and any names (Year > Module > Topic > Subtopic, or whatever you like). In **Structure** an admin can add, rename, reorder, move, lock ("coming soon") and hide sections. A section can't be deleted while it holds questions. Names live in the database, so future committees never edit code.

Site name and role labels are in `src/config.js`.

## Deploying changes

1. Upload the changed files to the GitHub repo (`sotonmuslimmedics-hub/question-bank`). Cloudflare rebuilds automatically.
2. Database changes are already applied to the Supabase project. The old `years/modules/weeks` tables are kept only so the previous site keeps working until this version is live; they can be dropped later.

## Supabase settings to check

- **Auth > URL Configuration**: add `https://<your-site>/reset-password` to Redirect URLs, or password-reset emails won't work.
- **Auth > SMTP**: the built-in email sender is heavily rate-limited. Add a free custom SMTP (Resend or Brevo) before students sign up in bulk.
- Free plan has no automatic backups: use **Tools > Back up questions** regularly.

## Importing the old spreadsheets

**Tools** has two importers (CSV). MCQs arrive as drafts by default; photo-station rows arrive as drafts and need their photo pasted in (open the question, Ctrl/Cmd+V), then publish. New sections created by an import start locked.

## Development

```
npm install
cp .env.example .env   # fill in the Supabase URL and publishable key
npm run dev
npm test
npm run build
```
