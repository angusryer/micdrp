# micdrp — Handoff

Status snapshot for picking the project back up. Everything described here is
merged to `main` unless marked **Phase V** (needs a real dev machine) or
**Deferred**.

> **One-paragraph summary.** micdrp is a React Native singing app with three
> tabs — **Practice** (sing against a target melody, scored, with a live target +
> pitch overlay), **Notes** (record sung musical-idea memos that are analysed and
> kept), and **Dashboard** (training trend + the singer's melodic/harmonic
> tendencies mined from their notes corpus). The performance-critical pitch
> detection runs in a **shared C++ DSP core** on the audio thread (never the JS
> thread); melodies render as a live (and static, piano-roll) **time × pitch**
> view. Accounts/storage/sync use **Supabase** (Postgres + Auth + Storage).
> Post-take and corpus analysis run **on-device** by reusing the pure-TS `logic`
> package. The whole app is built and CI-green for everything verifiable without a
> device; the remaining work is a human running the native build once (Phase V).

---

## 1. What exists (merged to `main`)

| Area | State |
|---|---|
| **Pure-TS DSP core** (`packages/logic`) | Complete + unit-tested: `detectPitch` (MPM/NSDF), `frequencyToNote`, `smoothPitch`, `segmentNotes`, `notesToMidi`, `scorePitch`, `detectKey`, `estimateTempo`. CI-green. |
| **Domain/contract types** | `packages/shared` (API DTOs: `NoteDto`/`PracticeProgressDto`/`FeedbackDto`/`ProfileDto`/`AppError`). Analysis primitives (`NOTE_NAMES`, `PitchFrame`, `TargetNote`, `DEFAULT_TOLERANCE_CENTS`) live in `packages/logic`. (The old `packages/models` was deleted — it was orphaned.) |
| **Corpus analysis** (`packages/logic/analysis.ts`) | `melodyToIntervals`, `intervalHistogram`, `frequentFragments`, `impliedHarmony` (template-matching, tuneable), `chordReflection` (key-relative), `avoidanceProfile` (distance from the singer's centroid), `analyzeCorpus`. Pure, unit-tested, perceptually grounded. |
| **Native C++ DSP** (`packages/client/cpp/dsp`) | `Mpm`, `notes`, `ring_buffer`, `pitch_engine` — a port of `logic`, **host-compiled + parity-tested** against the TS oracle (`PARITY OK`). |
| **Native audio bridge** | iOS `AudioEngineModule.{h,mm}` (AVAudioEngine) + Android `AudioEngineModule.java` + `cpp/audio_jni.cpp` → feed C++ MPM, emit throttled `PitchSample`. TS wrapper `src/audio/AudioEngine.ts` + `useAudioEngine` selects Tier 1 (native) or Tier 2 (audio-api worklet). |
| **App** (`packages/client/src`) | **3 tabs: Practice · Notes · Dashboard**, plus a header button → **Account & Settings**. Capture primitives (Skia + Reanimated live pitch line, off-JS-thread) live in `screens/capture/`; XState machines; navigation gated on auth. |
| **Notes** | `src/screens/Notes/` — capture (no score gate) + list + per-note detail/analysis (key, tempo, range, steadiness, tap-to-hear, MIDI export) + playback. `useNoteCapture` (analyse + save), `useNotes` (cache-first list), `analysis/note.ts`. The `melody_json` is persisted so corpus analysis never re-touches audio. |
| **Dashboard** | `src/screens/Dashboard/` — training trend (`TrendChart`, Skia) from `practice_progress`, most-common patterns (intervals / fragments / chord changes) and most-avoided patterns from `analyzeCorpus`. `useDashboard` recomputes on change. |
| **Melody piano-roll** | `src/components/MelodyView.tsx` (Skia) over a pure, unit-tested `src/components/melodyLayout.ts` — a static time × pitch view of a melody. Used in Note detail (a "Shape" section), each Note card, and the Dashboard fragment thumbnails. The static counterpart to the live capture pitch line. |
| **Auth + backend** | Supabase: `src/lib/supabase.ts` + Keychain session adapter (`src/lib/secureSession.ts`); `src/auth/` (AuthContext/useAuth/LoginScreen); `supabase/` (schema, RLS, `notes` storage bucket, `delete_account` RPC). |
| **Data + sync** | `src/data/notesRepo.ts` + `notesSync.ts`/`notesCache.ts` (notes cloud CRUD + cache, melody included), `practiceProgressRepo.ts` + `practiceProgressSync.ts` (trajectory), `profilesRepo.ts`, `currentUser.ts`; server-authoritative MMKV cache; one store. |
| **Account & Settings** | `src/screens/Account/AccountScreen.tsx` consolidates the old Profile + Settings (account, chord-inference knobs, engine tuning, theme, about), reached via a header button. `useProfile` + `useSettings` + `useAnalysisSettings`. |
| **Practice (full)** | Practice tab → pick exercise (`screens/Practice/PracticeScreen`) → `PracticeSession` records against the melody with target+live pitch scrolling in sync (`PracticePitchView`, Skia) and adaptive reference audio (play-along on headphones / count-in otherwise, `usePracticeSession` + `audio/outputRoute`) → Results scores against the chosen melody and writes a `practice_progress` row (no audio kept). Engine: `logic/melodies.ts` + `audio/referenceTone.ts`. |
| **On-device feedback** | `src/analysis/feedback.ts` → `FeedbackDto` from `logic`, surfaced in Results. |
| **i18n** | `src/i18n/` (i18next + device locale); Practice/Notes/Dashboard/Account/Settings keyed. |
| **CI** | `lint` + `typecheck` + pure-TS `test` all green. Gated to `workflow_dispatch` (manual). |
| **Deployment** | `packages/client/fastlane/` + `.github/workflows/release-{ios,android}.yml` (manual) + `scripts/`. |

### Key docs
- `docs/ARCHITECTURE.md` — data-flow + package map + the 3-tier DSP model.
- `docs/NATIVE_BUILD_PLAN.md` — the native build spec (tier model §0, contract §2).
- `docs/PROJECT_COMPLETION_PLAN.md` — the Supabase stack decision + completion plan.
- `docs/NATIVE_SETUP.md` — **the Phase V runbook** (pod install, Gradle, Xcode steps).
- `docs/DEPLOYMENT.md` — signing, secrets matrix, release runbook.
- `docs/AUDIT_FINDINGS.md` — cleanliness audit results + deferred items.
- `docs/OPEN_QUESTIONS.md` — parked product-UX decisions.
- **`docs/NOTES_MODULE_DESIGN.md` — the NEXT build: Notes + Dashboard module (see §8).**
- `docs/OPEN_QUESTIONS.md` — parked product-UX decisions (practice mode, sharing).

---

## 2. Architecture in one diagram

```
Mic ─► native capture (AVAudioEngine / AudioRecord, C++)
        │  Float32 frames, real-time audio thread
        ▼
   C++ MPM (cpp/dsp)            ← Tier 1 canonical (Tier 2 fallback: audio-api worklet running logic)
        │  {hz, clarity, midi, cents}
        ▼
   throttled PitchSample (≤60Hz, via JSI / event emitter)   ← PCM never crosses to JS
        ▼
   Reanimated shared value ─► Skia pitch line (UI thread, 60/120fps)
        │  (on stop)
        ▼
   logic pipeline: smoothPitch → segmentNotes → notesToMidi / scorePitch / detectKey / estimateTempo
        ▼
   FeedbackDto (on-device)  +  upload to Supabase (Postgres row + Storage blobs)
```

**Architectural law (enforced, keep enforcing):** heavy processing native/compiled;
no shims/patches/back-compat; one source of truth (`logic`/`shared`/`supabase`).

---

## 3. Phase V — the human-on-hardware handoff (the real remaining work)

This sandbox can't build iOS/Android, run a device, or install JS deps (no
registry egress). Everything below needs a Mac + Android tooling. Full detail in
`docs/NATIVE_SETUP.md`.

1. **Regenerate the lockfile.** The committed `yarn.lock` predates the native +
   Supabase deps. Run `corepack enable && yarn install` to resolve and lock
   `react-native-audio-api`, `react-native-reanimated`, `@shopify/react-native-skia`,
   `@react-navigation/*`, `react-native-mmkv`, `react-native-keychain`,
   `@supabase/supabase-js`, `i18next`/`react-i18next`, `react-native-localize`,
   `react-native-url-polyfill`, etc. **This also unblocks the client Jest suite and
   lets CI auto-triggers be re-enabled** (see §5).
2. **Confirm the `react-native-audio-api` version** against the installed RN
   (pinned `^0.12.2` by inspection; verify the worklet/AudioRecorder API).
3. **iOS:** `cd packages/client/ios && bundle install && pod install`; in Xcode add
   `AudioEngineModule.mm` + `cpp/dsp/*.cpp` to the target's Compile Sources +
   header search path (one-time; documented). Set New Arch flags.
4. **Android:** Gradle sync; the CMake (`add_subdirectory .../cpp`) and
   `AudioEnginePackage` registration are already wired.
5. **Provision Supabase:** create a project, run `supabase db push`
   (`supabase/migrations/0001_init.sql`), set `SUPABASE_URL` + `SUPABASE_ANON_KEY`
   in `packages/client` env (`react-native-config`; values via git-secret, never committed).
6. **Boot on device,** fix any build errors, run the full `yarn test` (client suite).

---

## 4. Deferred / open items

Cleanup items 1–5 below were **resolved in the completion batch** (see
`docs/AUDIT_FINDINGS.md`):

1. **iOS legacy demo module removal — DONE** (files + all 8 pbxproj refs gone).
2. **`models` package — DELETED** (orphaned; truth now in `logic` + `shared`).
3. **`IN_TUNE_TOLERANCE_CENTS` duplicate — RESOLVED** (`logic` owns
   `DEFAULT_TOLERANCE_CENTS`; removed from `shared`).
4. **Stale prebuilt bundle — DELETED + gitignored.**
5. **Live theme swap — DONE** — `ThemeProvider` now owns the palette
   (`useTheme().setPalette`), recolors the live tree, and restores the persisted
   choice on cold start (it was previously ignored). `useSettings` no longer
   handles the palette.

Still deferred (small, non-blocking):
- **midi→label inline math** — `Record/NoteRibbon` + `Results/NoteList` inline
  midi→name; revisit if `logic` exposes a worklet-safe label helper.

### Product features
- **Profile / account management — BUILT** (display-name edit, sign out, delete
  account incl. the `delete_account` RPC). Its own tab.
- **Practice / target-melody — BUILT.** Full flow: Practice tab → exercise
  picker → recorded session with target+live pitch scrolling in sync and adaptive
  reference audio → Results scored against the chosen melody. Remaining gaps
  (native headphone-route probe, remote/imported catalogue, rubato scoring) are in
  `docs/OPEN_QUESTIONS.md`.
- **Results "tap a note to hear it"** and **password reset** (Login "Forgot
  password?") also shipped.
- **Sharing/social** — still future scope (see `docs/OPEN_QUESTIONS.md`).

---

## 5. CI notes (important)

- Jobs: `lint`, `typecheck`, `test` (+ GitGuardian). All green on `main`.
- **`test` runs only `logic`/`shared`** (the pure-TS core) via
  `TEST_PACKAGES="logic shared" yarn test`. The client RN suite is skipped
  in CI because the stale-lockfile `node_modules` can't resolve the RN UI stack
  under Jest. After Phase V step 1, drop the `TEST_PACKAGES` override so CI runs the
  full `yarn test`, and re-enable `push`/`pull_request` triggers in
  `.github/workflows/ci.yml` (currently `workflow_dispatch` only). The client Jest
  setup now mocks `react-native-config`, so supabase-importing suites (App smoke,
  Profile, data repos) can import `lib/supabase` without throwing.
- Gotcha already solved: invoke tests via the root `yarn test` (test.sh), not
  `yarn workspace <pkg> test` directly — Yarn 3 only exposes a workspace's own
  dependency binaries, so a direct call gives `command not found: jest`.
- The client Jest setup uses `{ virtual: true }` native-module mocks
  (`jest.setup.js`) so suites can run without the real native deps installed.

---

## 6. Workflow / repo conventions

- **Dev branch:** `claude/latest-repo-changes-vip5ss`, always reset onto the latest
  merged `main` before new work. Merged PRs are final; start follow-up work fresh
  off `main` (force-with-lease the branch when it only carries already-merged history).
- **Merges:** repo disallows merge commits → use **squash**.
- Monorepo: Yarn 3 (Berry), `nodeLinker: node-modules`, Corepack. Packages:
  `client` (RN app), `logic`, `shared`. (The Express `server` and the orphaned
  `models` packages were deleted — backend is Supabase; domain truth is `logic`+`shared`.)
- Build is **authored, not device-tested** except the C++ core (host-verified).

---

## 7. Suggested next steps (when you resume)

1. **Phase V** (a few hours on a Mac): regenerate the lockfile, `pod install` +
   Xcode wiring, Gradle, provision Supabase, boot on a device. Turns the scaffold
   into a running app and flips CI fully green incl. the client suite. This now
   also exercises the new `notes` + `practice_progress` schema (apply migration
   `0001_init.sql` to a fresh project — it is a clean rewrite, no `recordings`).
2. **Notes/Dashboard polish on hardware**: chart visual design, note titling/tags,
   optional MIDI import path (see `docs/NOTES_MODULE_DESIGN.md` §11) — all deferred.

*(Practice mode, account/profile, and the **Notes + Dashboard module** are all
built and merged — see §1 and §8.)*

---

## 8. Notes + Dashboard module — BUILT

Design spec: **`docs/NOTES_MODULE_DESIGN.md`**. What shipped:

- **Freeform recording reframed as "Notes."** The old **Record + Library** tabs
  collapsed into one **Notes** surface (`screens/Notes/`): capture a sung idea →
  analyse → keep. Self-score logic is **kept but reframed as descriptive analysis**
  (key/tempo/range/steadiness), no grade. `melody_json` is persisted so analysis is
  pure-data.
- **On-device corpus analysis** (`packages/logic/analysis.ts`): interval histogram,
  recurring **fragments** (phrase-aware interval n-grams, with a playable example),
  **chord reflection** (template-matched implied harmony, key-relative, tuneable),
  and an **avoidance profile** ("most avoided" = furthest from the singer's
  common-pattern centroid). All perceptually grounded and unit-tested.
- **`Dashboard` tab** (`screens/Dashboard/`): training-progress trend (`TrendChart`,
  Skia) from `practice_progress` + most-common + most-avoided patterns.
- **IA → 3 tabs**: **Practice · Notes · Dashboard**; Profile + Settings merged into a
  single **Account & Settings** screen (`screens/Account/`) reached from a header
  button, with the chord-inference tuning knobs.
- **Data**: `recordings` replaced by `notes` (+ `melody_json`) and `practice_progress`
  (trajectory only, no audio). Migration `0001_init.sql` rewritten; `Database` type +
  `shared` DTOs updated; storage bucket renamed `takes` → `notes`.
- Compute is **on-device, recomputed on change** (no server job).
- **Melody piano-roll** (follow-up, merged): `src/components/MelodyView.tsx` +
  pure `melodyLayout.ts` render a melody as a static **time × pitch** view, used
  in Note detail ("Shape"), the Note cards, and the Dashboard fragment thumbnails.

Remaining (deferred) items are in `docs/NOTES_MODULE_DESIGN.md` §11 and §7 above.
