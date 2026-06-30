# micdrp — Supabase backend setup

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) >= 1.142
- A free [Supabase account](https://supabase.com/)
- Node / yarn (already in the monorepo root)

---

## 1. Create a remote project

1. Go to <https://supabase.com/dashboard> and create a new project.
2. Choose a region close to your users.
3. Copy the **Project URL** and **anon public key** from
   **Settings > API** — you will need them in step 3.

---

## 2. Link the CLI to your remote project

```bash
# From the repo root (or supabase/ directory):
supabase login
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` is the slug in your dashboard URL:
`https://supabase.com/dashboard/project/<your-project-ref>`

---

## 3. Set client environment variables

The React Native client reads credentials via `react-native-config`.
Create `packages/client/.env` (never commit this file — it is in `.gitignore`):

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-public-key>
```

For CI, add both values as repository secrets and inject them as environment
variables before the build step.

---

## 4. Apply the database migration

```bash
# Push the migration to your remote project:
supabase db push
```

This runs `supabase/migrations/0001_init.sql` which:
- Creates the `profiles` table (1:1 with `auth.users`) with RLS.
- Creates the `recordings` table with RLS.
- Installs a trigger that inserts a `profiles` row for every new auth user.
- Creates the private `takes` storage bucket with owner-only object policies.

To reset a **local** development database (if you run `supabase start`):

```bash
supabase db reset   # drops, migrates, and optionally seeds
```

---

## 5. Storage bucket

The migration creates the `takes` bucket automatically.

Object path convention: `<user_id>/<recording_id>.<ext>`

- Audio: `<user_id>/<recording_id>.m4a`
- MIDI: `<user_id>/<recording_id>.mid`

The bucket is **private**. The client accesses blobs via signed URLs generated
by the Supabase SDK (`supabase.storage.from('takes').createSignedUrl(...)`).

---

## 6. Auth settings (dashboard)

In **Authentication > Providers** enable **Email** (already on by default).
You may also enable Apple / Google Sign-In for mobile — no schema changes
are needed; the trigger handles all new auth users regardless of provider.

---

## 7. Local development (optional)

```bash
supabase start          # starts local Postgres + Auth + Storage + Studio
supabase db reset       # reset + seed
supabase stop           # when done
```

Studio runs at <http://127.0.0.1:54323> by default.

---

## Files in this directory

| File | Purpose |
|------|---------|
| `config.toml` | Supabase CLI project config (no secrets) |
| `migrations/0001_init.sql` | Initial schema: profiles, recordings, RLS, storage bucket |
| `seed.sql` | Optional minimal seed (no secrets, no auth users) |
| `README.md` | This file |

---

## Security notes

- Never commit `.env`, `supabase/.env`, or any file containing
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` values.
- The anon key is safe to ship in the mobile bundle (it is public by design),
  but Row-Level Security ensures users can only access their own data.
- The service-role key is a secret and must never be committed or embedded
  in the mobile app.
