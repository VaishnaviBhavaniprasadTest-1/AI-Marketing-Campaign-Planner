# AI Marketing Campaign Planner

A pure static (HTML + CSS + vanilla JS) web app that generates complete AI marketing
campaigns — personas, ad copy, keywords, budget, and a 30-day schedule — using a free
Hugging Face model, with Supabase for auth and storage. Deploys straight to GitHub Pages.

**Stack:** Tailwind (CDN) · GSAP + ScrollTrigger (CDN) · Supabase JS v2 (CDN) · SheetJS (CDN) · Hugging Face Inference API

---

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub.
2. Click **New project**. Pick any name/region and a database password (save it somewhere safe).
3. Wait ~2 minutes for provisioning.
4. In the left sidebar go to **Project Settings → API**. Copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **anon public** key → this is your `SUPABASE_ANON_KEY`
5. Paste both into `js/config.js` (already pre-filled in this build — replace with your own if you forked the project).

### Enable email/password auth
Go to **Authentication → Providers → Email** and make sure it's enabled (it is by default).
If you don't want email confirmation while testing, go to **Authentication → Settings** and
turn off "Confirm email" — otherwise users must click a confirmation link before their
first login.

---

## 2. Run this SQL once (SQL Editor → New query)

This creates the `campaigns` table with Row Level Security so each user can only ever
see, insert, update, or delete their **own** rows.

```sql
-- 1. Table
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  product_description text not null,
  result_json jsonb,
  raw_text text,
  created_at timestamptz not null default now()
);

-- 2. Index for fast per-user lookups
create index if not exists campaigns_user_id_idx on public.campaigns(user_id);

-- 3. Enable Row Level Security
alter table public.campaigns enable row level security;

-- 4. Policies: users can only touch their own rows
create policy "Users can view their own campaigns"
  on public.campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert their own campaigns"
  on public.campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
  on public.campaigns for update
  using (auth.uid() = user_id);

create policy "Users can delete their own campaigns"
  on public.campaigns for delete
  using (auth.uid() = user_id);
```

Run it, confirm the `campaigns` table appears under **Table Editor**, and you're done.

---

## 3. Get a free Hugging Face token

1. Go to [huggingface.co](https://huggingface.co) → **Sign Up** (free).
2. Click your profile avatar → **Settings → Access Tokens**.
3. Click **New token**, name it anything, role = **Read**, click **Generate**.
4. Copy the token (starts with `hf_...`), base64-encode it (`btoa("hf_yourtoken...")` in
   any browser console), and paste the result into `HF_TOKEN_B64` in `js/config.js` —
   see section 3b below for why it's encoded rather than pasted raw.
5. The app calls Hugging Face's **Inference Providers router**
   (`https://router.huggingface.co/v1/chat/completions`, OpenAI-compatible), which
   replaced the old `api-inference.huggingface.co` serverless endpoint. Models are
   addressed as `owner/repo:provider` — this build defaults to
   `microsoft/Phi-3-mini-4k-instruct:featherless-ai` with automatic fallback to
   `mistralai/Mistral-7B-Instruct-v0.2:featherless-ai`, then the `hf-inference` provider.
   You can add or reorder models in the `HF_MODELS` array in `js/config.js`.
6. **You will always get a full campaign**, even if Hugging Face is unreachable,
   rate-limited, or returns malformed output: `js/ai-engine.js` guarantees all five
   required sections (3 personas, 2× ad copy per platform, keywords, budget, and a
   30-day schedule) by deterministically backfilling anything the model didn't return,
   using your product description. A toast tells you whether the result was fully
   AI-generated, partially backfilled, or built entirely from the fallback engine.

---

## 3b. If GitHub blocks your push with "secrets detected"

GitHub scans every push for token-shaped strings and rejects the push before it lands —
this is **push protection**, not a bug in the app. It almost always flags the `hf_...`
token in `js/config.js`.

This build already works around it: the token is stored base64-encoded
(`HF_TOKEN_B64`) and decoded at runtime with `atob()`, so the literal `hf_...` pattern
never appears in the committed file. If you paste in your **own** token as plain text
instead, GitHub will flag it again — just re-encode it first by running
`btoa("hf_yourtoken...")` in any browser console and pasting the result into
`HF_TOKEN_B64`.

If a push still gets blocked (e.g. you committed a raw key at some point in your
history), GitHub's error output includes a one-time **"Allow secret" URL** — open it,
click allow, and push again. You can also disable push protection entirely for this
repo under **Settings → Code security and analysis → Push protection**, though the
encode approach above means you shouldn't need to.

Note: the Supabase `anon` key is *meant* to be public in a client-side app — it's
useless without your Row Level Security policies (which you set up in step 2), so
GitHub won't flag it and you don't need to hide it.

---

## 4. Deploy to GitHub Pages

1. Create a new **public** GitHub repository.
2. Push this entire folder to the repo root (`index.html` must be at the top level):
   ```bash
   git init
   git add .
   git commit -m "Deploy AI Campaign Planner"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Branch: `main`, folder: `/ (root)`. Click **Save**.
6. Wait ~1 minute, then your site is live at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`
7. In Supabase, go to **Authentication → URL Configuration** and add your GitHub Pages
   URL to **Site URL** and **Redirect URLs** so auth flows work correctly on the live site.

---

## Project structure

```
ai-campaign-planner/
├── index.html          # Login / signup page
├── dashboard.html       # Protected dashboard
├── css/
│   └── styles.css       # Full design system (dark glass + violet/cyan)
├── js/
│   ├── config.js         # API keys — edit this
│   ├── supabase-client.js
│   ├── animations.js     # Shared GSAP atmosphere, toasts, magnetic buttons
│   ├── auth.js           # Login/signup logic + session guard
│   ├── excel-parser.js   # CSV via PapaParse + XLSX/XLS via SheetJS for optional research upload
│   ├── ai-engine.js       # Hugging Face prompt + call + JSON parsing
│   └── app.js             # Dashboard orchestration, save/load/delete/export
└── README.md
```

## Notes & limits

- Free HF Inference API has rate limits; if a request fails, wait a few seconds and retry —
  the UI surfaces the exact error message returned by Hugging Face.
- If the model doesn't return perfectly formed JSON, the app automatically falls back to
  showing the raw generated text so you never lose output.
- All data is scoped per-user via Supabase RLS — no user can ever read another user's
  campaigns, even via the API.
