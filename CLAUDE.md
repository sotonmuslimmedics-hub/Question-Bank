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
- `lead` (2) — academic leads: can publish/edit/move/delete any question, manage the section structure (`Structure.jsx`) and the subject list (`Subjects.jsx`) — add/rename/reorder only, deleting stays admin-only — tag questions for mock exams, and see cohort-level `Insights` (hardest topics/questions)
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
- **`title`** (optional short label on `questions`, max 120 chars, set in `QuestionEditor.jsx`) exists so
  leads can tell apart the ~100 photo questions that all begin "Study the image below…". The Questions page
  (`ManageQuestions.jsx`) shows `title`, else the first part's prompt for a generic photo stem, else the stem,
  plus each part's prompt and first accepted answer. Any `.select()` that feeds `QuestionEditor` must include
  `title` (`ManageQuestions.jsx`, `Teach.jsx`, `Insights.jsx`'s `FULL_SELECT`); the editor only writes `title`
  when the row it was given has it, so a missed select can't blank it. Students never see it.
- **Questions-page search** calls the Postgres function `search_question_ids(text)` (stem, title, part prompts and
  accepted answers; plain substring match; runs as the caller so RLS applies; returns at most 150 ids — keep
  `SEARCH_CAP` in `ManageQuestions.jsx` in step with the `limit 150` inside the function). It exists because PostgREST
  can't OR a condition on a question with one on its child `question_parts` rows.
- **Timed mock exams.** Tables `mock_papers`, `mock_paper_questions`, `mock_attempts`, `mock_answers`; MCQ only;
  retakes allowed (one sitting in progress at a time); an open window per paper (`status` draft/live/closed plus
  optional `opens_at`/`closes_at`). Screens: students `Mocks.jsx` (list) → `MockExam.jsx` (timer, autosave, flags,
  submit) → `MockResults.jsx` (score, subjects, cohort percentile, review); leads `admin/MockPapers.jsx` (create,
  order, set live, close, release, preview) plus "Add to paper…" on the Questions page
  (`components/AddToPaperDialog.jsx`). A paper's questions may be published or unpublished — here "unpublished" only means "not shown in normal
  practice yet" (MMS leads keep finished questions unpublished until they want students to see them), so going live never
  checks it. Releasing a paper clears the hold only; questions still unpublished stay hidden until a lead publishes them.
  Not built yet:
  per-paper stats for leads, copying mock answers into Missed mode, payment (see hook below). Rules to keep:
  - **Held questions.** A question in any unreleased paper has `questions.mock_hold = true` (kept in step by
    triggers) and the `questions read by section` policy hides it from students — Practise/Quiz never see it. Leads
    still see everything. `mock_release(paper)` closes a paper and frees its questions. Don't `select` held
    questions from the browser for students; they only reach the exam screen through `mock_get`.
  - **Students never write mock tables directly.** All sitting logic is in security-definer functions:
    `mock_list`, `mock_start`, `mock_get`, `mock_save`, `mock_submit`, `mock_results` (+ lead-only `mock_release`).
    The deadline is stored server-side (`deadline_at`, 15 s grace); expired sittings are scored lazily the next time
    they're read. `mock_get` never returns correct answers or explanations; `mock_results` does, only once submitted.
  - **Payment hook.** `mock_can_access(paper)` currently returns true for everyone; change it when payment goes live.
  - **Privacy.** Sittings are readable only by their owner (not even admins). The cohort percentile in
    `mock_results` appears only when 5+ students have sat the paper, using each student's first sitting.
  - Mock answers are separate from `attempts`, so they don't affect Insights or the New/Missed modes.
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

## Student data / privacy rule (keep this when adding analytics)

The Insights page (`src/pages/admin/Insights.jsx`) reads only the Postgres
functions `insights_summary`, `insights_topics` and `insights_questions`. They
return **aggregates only** (never user ids or names), return nothing to non-leads,
and drop any topic/question answered by fewer than 5 distinct students so a small
group can't identify one person. Don't add per-student views for leads without a
clear purpose, a privacy notice, and ideally the student opting in. (Note: the
`attempts` RLS policy lets admins read individual rows — the app itself shouldn't
surface them.)

## "Published" vs "Not live" — what it means here

There is **no review stage**: every question is ready the moment it is written. `questions.is_published` is purely a
**visibility switch** — shown in the UI as **Live** / **Not live**. Leads keep finished questions Not live until they want
students to see them (e.g. after a teaching session), and a *locked* or hidden section hides everything in it regardless.
Don't build "needs review" features on top of Not live (the ~850 unpublished questions are ready, just held back).
Student-teachers' questions arrive Not live because the database only lets them insert unpublished rows; a lead makes them live.

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
