# Question Bank — project guide for Claude

This file is read automatically by Claude Code at the start of every session in
this repo. Keep it up to date when something structural changes — it's the
fastest way for a future committee member (technical or not) to get AI help
without having to re-explain the whole project first.

## What this is

A Southampton-style MCQ/practical question bank web app for **Medics
Southampton (MMS)** — a React + Vite single-page app, deployed on **Cloudflare
Workers**, backed by **Supabase** (Postgres + Auth + Storage).

- Repo: `sotonmuslimmedics-hub/Question-Bank`
- Live site: deployed automatically by Cloudflare on every push to `main`
  (no manual deploy step — just push and it rebuilds)
- Supabase project: "Question Bank" — org `sotonmuslimmedics-hub's Org`,
  currently on the **Free plan** (watch Storage/Egress quotas as usage grows —
  see Supabase dashboard → Usage)

## Who this is for

Student committees change every year. Whoever is using Claude to work on this
— president, tech lead, or anyone else — should be able to just describe the
problem in plain English ("students say X is broken", "can you add Y") and
let Claude read this file, explore the code, and make the fix. You do not
need to know React, SQL, or Git to ask for help here.

## Role model (important — read before touching permissions)

Three roles, enforced both in the database (RLS policies) and mirrored in the
frontend (`src/lib/auth.jsx`, `RANK` ladder):

- `student` (0) — can take quizzes, see published questions
- `teacher` (1) — can also write draft questions (not published until a lead/admin approves) — this is the "student-teacher" role, see `Teach.jsx`
- `lead` (2) — academic leads: can publish/edit/move/delete any question, manage the section structure (`Structure.jsx`), tag questions for mock exams
- `admin` (3) — everything leads can do, plus delete sections, manage people's roles, access `Tools.jsx` (backups, importer, orphaned-image cleanup)

Postgres helper functions `is_admin()`, `is_lead()`, `is_staff()` are used in
RLS policies — if you change what a role can do, you usually need to change
**both** the RLS policy (via a migration) **and** the frontend route/nav gate
(`App.jsx` + `Layout.jsx`'s `useNav()`), or a page will be reachable but
broken, or hidden but actually allowed.

## Known sharp edges (read before changing the `questions` table)

- **Adding a new nullable column to `questions`?** You must add it to
  *every* `.select(...)` string that fetches question rows (`Teach.jsx`,
  `ManageQuestions.jsx`, `Quiz.jsx`, `Tools.jsx`'s orphan scanner). PostgREST
  only returns columns you explicitly ask for — missing it anywhere causes
  silent bugs (field invisible in editor, nulled out on next save, or
  wrongly flagged as an "unused" image to delete). This has bitten us twice
  already (`explanation_image_path`, `exam_tag`).
- **Supabase Auth "Site URL"** (Dashboard → Authentication → URL
  Configuration) must be the bare origin only
  (`https://question-bank.sotonmuslimmedics.workers.dev`) — **no path**. Email
  templates build links as `{{ .SiteURL }}/auth/confirm?...`; a Site URL with
  a path (e.g. ending in `/login`) silently breaks every auth email site-wide.
- **Image uploads** are resized/compressed client-side to WebP
  (`src/lib/images.js`) with a JPEG fallback for browsers that silently
  refuse to encode WebP (notably older Safari). If images start appearing
  unusually large again, check `blob.type` handling in that file first.
- **`exam_tag`** (free-text column on `questions`) lets leads label a
  scattered selection of questions used in a mock exam, so they can filter
  back to that exact set later without reselecting — separate from the
  section/locking mechanism.

## Where things live (so Claude can be asked to check them)

- Frontend pages: `src/pages/` (student-facing) and `src/pages/admin/`
  (lead/admin tools)
- Shared UI/hooks: `src/components/`, `src/lib/`
- Supabase schema/RLS changes: via the Supabase MCP tools' migration
  mechanism — check `mcp__Supabase__list_migrations` for history before
  making a schema change
- Deploy config: `wrangler.jsonc` (Cloudflare Workers, SPA fallback mode)

## Getting AI help on this project, as a non-technical committee member

1. Open a Claude Code / Claude session connected to this repo (see the
   handover runbook for account access).
2. Describe the problem as a user would report it — you don't need to
   diagnose it yourself. E.g. "a student says uploaded images disappear
   when they reopen the question" is enough; Claude will investigate the
   code and logs.
3. For anything that touches money, deleting data, or changing who has
   admin access, have a second committee member sanity-check the change
   before it's pushed live — AI can misunderstand scope same as a person
   can.
4. After a fix is pushed to `main`, Cloudflare redeploys automatically
   (usually under a minute) — no separate deploy step needed.
