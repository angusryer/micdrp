# micdrp — Project Completion Plan (Supabase architecture)

> **Purpose.** Complete micdrp as a product: accounts, cloud storage of takes,
> cross-device sync, post-take analysis/feedback, i18n, and CI/quality — on a
> stack chosen for *what the app is for the user*, not to hand-roll every layer.
> This is the authoritative spec and the batchable work breakdown.

## 0. Stack decision & rationale

micdrp's differentiated value is the **real-time pitch experience**, which already
lives in the native C++ DSP core. Accounts, storage, and sync are commodity — so
we use a **Backend-as-a-Service** instead of hand-rolling Express + Redis + JWT +
a custom native token module. That hand-rolled stack is security-sensitive,
high-maintenance, undifferentiated code; replacing it with a managed SDK is the
clean, deep integration the project's own rules demand.

**Chosen:**
- **Supabase** — managed Postgres + Auth + Storage + Row-Level Security. One SDK
  (`@supabase/supabase-js`) for auth, data, and blob storage.
- **Token storage** — hardware-backed **Keychain/Keystore** via
  `react-native-keychain`, used as the Supabase auth session adapter. The correct,
  non-hand-rolled way to persist auth tokens. (No custom native token module.)
- **Analysis/feedback** — **on-device**, reusing the compiled `logic` pipeline.
  Offline, instant, no round-trip. No server compute.
- **Removed:** the Express `packages/server`, custom JWT/refresh auth, Redis.

**Architectural law (enforced in the final audit):**
1. Heavy processing lives in the native/compiled layer (C++ DSP on device; `logic`
   for post-take analysis). Never the React JS thread.
2. No shims, no patches, no compatibility layers. Clean, deep integrations only.
3. One source of truth: domain types in `models`, algorithms in `logic`, API/DTO
   contracts in `shared`, DB schema in `supabase/`. Import; never duplicate.

**Reality check.** Authored in a Linux sandbox: no device, no installed deps, no
Supabase project. C++ is host-compilable; everything else is validated by
inspection + the shared contract. Provisioning a Supabase project, `yarn install`,
`pod install`/Gradle, and device boot is the human's **Phase V**.

## 1. Data model (Supabase)

- `profiles` (1:1 with `auth.users`): id, display_name, created_at. RLS: owner-only.
- `recordings`: id, user_id, title, created_at, duration_ms, sample_rate_hz,
  note_count, score, key, tempo_bpm, audio_path, midi_path. RLS: owner-only.
- Storage bucket `takes`: `${user_id}/${recording_id}.{m4a,mid}`. RLS: owner-only.

## 2. The shared contract (authored before the batch)

`packages/shared/src/` — the single cross-cutting type surface (client + any future
edge functions):
- `dto/recording.ts` — `RecordingDto`, `CreateRecordingInput`
- `dto/feedback.ts` — `FeedbackDto` (overallScore, strengths, improvements,
  suggestions, perNote[]), produced on-device from `logic`
- `dto/profile.ts` — `ProfileDto`
- `errors.ts` — `AppErrorCode`, `AppError`
- `constants.ts`, `index.ts`
Domain types (`PitchSample`, `NoteEvent`, `Recording`) stay in `models`/`logic`.

## 3. Work packages (the batch)

Order: shared spine + server removal first (author). Then fan out (disjoint paths).
SYNTH reconciles.

### WP-SUPABASE — backend definition
- `supabase/config.toml`, `supabase/migrations/0001_init.sql` (profiles +
  recordings + RLS policies + the `takes` bucket), `supabase/seed.sql`,
  `supabase/README.md` (project setup, `supabase db push`, env vars). Optional
  `supabase/functions/` left empty (analysis is on-device). No secrets committed.

### WP-CLIENT-SUPABASE — SDK client + secure session (foundation for client WPs)
- `src/lib/supabase.ts` — the typed client; auth `storage` adapter backed by
  `react-native-keychain` (`src/lib/secureSession.ts`). Deps:
  `@supabase/supabase-js`, `react-native-keychain`, `react-native-url-polyfill`.
  Config (URL/anon key) via `react-native-config` env. Tests with mocked keychain.

### WP-CLIENT-AUTH — auth flow
- `src/auth/AuthContext.tsx` (+ `useAuth`) over `supabase.auth`
  (signUp/signIn/signOut/onAuthStateChange) — **replaces** the mock
  `context/UserContext.tsx` (delete it). Real `src/screens/Login/LoginScreen.tsx`.
  Gate the navigator on session. Tests with a mocked supabase client.

### WP-CLIENT-DATA — cloud recordings + sync
- `src/data/recordingsRepo.ts` — Supabase Postgres + Storage CRUD against
  `shared` DTOs. `src/data/sync.ts` — local-first reconcile of the existing MMKV
  index with Supabase (server-authoritative on conflict). Wire `useLibrary` +
  Results persistence to it (replace the local-only path cleanly — no dual store).
  Tests with mocked supabase + the existing MMKV mock.

### WP-CLIENT-ANALYSIS — on-device feedback
- `src/analysis/feedback.ts` — run `logic` (smoothPitch → segmentNotes → scorePitch
  + key + tempo) over `RecordingHandle.samples`, synthesize a `shared` `FeedbackDto`.
  Surface it in Results (extend `useResults`/`ScoreCard` cleanly). Tests with fixtures.

### WP-CLIENT-I18N — internationalization
- `src/i18n/{index.ts,locales/en.json}` (i18next + react-i18next + device locale),
  provider mounted in `app/providers.tsx`, screen strings → keys. Tests.

### WP-LOGIC — analysis completeness
- `logic/src/key.ts` (Krumhansl-Schmuckler key/scale), `logic/src/tempo.ts`
  (onset/tempo from `NoteEvent[]`), barrels + tests. Feeds WP-CLIENT-ANALYSIS.

### WP-CI — pipeline + quality gates
- Re-enable `.github/workflows/ci.yml` (push/PR), drop the server job, keep
  lint/test/typecheck across logic/models/shared/client, add `license-checker` +
  OWASP `dependency-check` scripts to root `package.json`. Release workflows stay manual.

### WP-SYNTH — reconciliation
- Every cross-package import resolves; client mounts AuthProvider + i18n; navigator
  gates on session; Library/Results use the cloud repo + on-device feedback; no
  duplicate stores; `shared` imported, not duplicated. Surgical fixes only.

## 4. Dispatch order
1. Author + commit: revised plan, `shared` spine, **remove Express server**.
2. **Wave A** (parallel): WP-SUPABASE, WP-CLIENT-SUPABASE, WP-LOGIC, WP-CI.
3. **Wave B** (parallel, reads A): WP-CLIENT-AUTH, WP-CLIENT-DATA,
   WP-CLIENT-ANALYSIS, WP-CLIENT-I18N.
4. **WP-SYNTH** → commit/push/merge.
5. **Audit run** (separate): dedup, consolidate, enforce the architectural law,
   delete dead/legacy code (e.g. demo `AudioControlModule`), zero shims.

## 5. Invariants for every agent
- Import from `shared` (DTOs), `models` (domain), `logic` (algorithms),
  `src/lib/supabase` (backend). Never duplicate; never hand-roll auth/storage.
- No shims/patches/back-compat. Clean, deep integrations only.
- Heavy processing → native/compiled. Never the JS thread.
- No secrets/keys/URLs committed — Supabase URL + anon key via env/CI.
- TypeScript strict-clean; a test beside each non-trivial unit. Untested-on-device OK.
