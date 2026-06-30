# micdrp — Handoff

Status snapshot for picking the project back up. Everything described here is
merged to `main` unless marked **Phase V** (needs a real dev machine) or
**Deferred**.

> **One-paragraph summary.** micdrp is a React Native singing app: you sing, it
> shows your pitch in real time, scores the take, and gives feedback. The
> performance-critical pitch detection runs in a **shared C++ DSP core** on the
> audio thread (never the JS thread). Accounts/storage/sync use **Supabase**
> (managed Postgres + Auth + Storage). Post-take analysis runs **on-device** by
> reusing the pure-TS `logic` package. The whole app is built and CI-green for
> everything verifiable without a device; the remaining work is a human running
> the native build once (Phase V).

---

## 1. What exists (merged to `main`)

| Area | State |
|---|---|
| **Pure-TS DSP core** (`packages/logic`) | Complete + unit-tested: `detectPitch` (MPM/NSDF), `frequencyToNote`, `smoothPitch`, `segmentNotes`, `notesToMidi`, `scorePitch`, `detectKey`, `estimateTempo`. CI-green. |
| **Domain/contract types** | `packages/models` (domain), `packages/shared` (API DTOs: `RecordingDto`/`FeedbackDto`/`ProfileDto`/`AppError`). |
| **Native C++ DSP** (`packages/client/cpp/dsp`) | `Mpm`, `notes`, `ring_buffer`, `pitch_engine` — a port of `logic`, **host-compiled + parity-tested** against the TS oracle (`PARITY OK`). |
| **Native audio bridge** | iOS `AudioEngineModule.{h,mm}` (AVAudioEngine) + Android `AudioEngineModule.java` + `cpp/audio_jni.cpp` → feed C++ MPM, emit throttled `PitchSample`. TS wrapper `src/audio/AudioEngine.ts` + `useAudioEngine` selects Tier 1 (native) or Tier 2 (audio-api worklet). |
| **App** (`packages/client/src`) | Record (Skia + Reanimated live pitch line, off-JS-thread), Results (score + feedback + MIDI export/share), Library (history + playback), Settings (engine tuning + theme); XState machines; navigation gated on auth. |
| **Auth + backend** | Supabase: `src/lib/supabase.ts` + Keychain session adapter (`src/lib/secureSession.ts`); `src/auth/` (AuthContext/useAuth/LoginScreen); `supabase/` (schema, RLS, `takes` storage bucket). |
| **Data + sync** | `src/data/recordingsRepo.ts` (cloud CRUD) + `src/data/sync.ts` (local-first MMKV cache reconcile); one store. |
| **On-device feedback** | `src/analysis/feedback.ts` → `FeedbackDto` from `logic`, surfaced in Results. |
| **i18n** | `src/i18n/` (i18next + device locale); Record/Library/Settings keyed. |
| **CI** | `lint` + `typecheck` + pure-TS `test` all green. Gated to `workflow_dispatch` (manual). |
| **Deployment** | `packages/client/fastlane/` + `.github/workflows/release-{ios,android}.yml` (manual) + `scripts/`. |

### Key docs
- `docs/ARCHITECTURE.md` — data-flow + package map + the 3-tier DSP model.
- `docs/NATIVE_BUILD_PLAN.md` — the native build spec (tier model §0, contract §2).
- `docs/PROJECT_COMPLETION_PLAN.md` — the Supabase stack decision + completion plan.
- `docs/NATIVE_SETUP.md` — **the Phase V runbook** (pod install, Gradle, Xcode steps).
- `docs/DEPLOYMENT.md` — signing, secrets matrix, release runbook.
- `docs/AUDIT_FINDINGS.md` — cleanliness audit results + deferred items.

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
no shims/patches/back-compat; one source of truth (`models`/`logic`/`shared`/`supabase`).

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

## 4. Deferred / open items (from the audit)

Tracked in `docs/AUDIT_FINDINGS.md`; none block Phase V:

1. **iOS legacy demo module removal** — delete `ios/AudioControlModule.{h,m}` and
   their 8 `project.pbxproj` references (exact entries listed in AUDIT_FINDINGS).
   Android side already removed. Human-only (Xcode).
2. **`models` package role** — domain types are reached via `contract`/`logic`,
   not directly; decide whether to keep `models` as the base or fold its used bits
   (`NOTE_NAMES`/`NoteName`) into `logic` and the rest into `shared`. Validate via CI.
3. **`IN_TUNE_TOLERANCE_CENTS` duplicate** — `shared/constants.ts` vs the `50`
   default in `logic/scoring.ts`; pick one owner once the models/shared boundary is set.
4. **Stale prebuilt bundle** — `android/app/src/main/assets/index.android.bundle`
   references removed demo code; regenerated on build, safe to delete + gitignore.
5. **Live theme swap** — `useSettings` persists the palette but `providers.tsx`
   reads a static default; wire a dynamic palette into `ThemeProvider` for live swap.
6. **`notes.ts` ↔ `models` NOTE_NAMES** — intentionally duplicated (keeps `logic`
   dependency-free for worklet/server). Don't "dedup" it again without a runtime test.

### Product features not yet built (future scope, not regressions)
- Reference-tone / backing-track playback to sing against (the original prototype's core).
- Target-melody mode (the `scorePitch` target path exists; no UI to pick a song yet).
- Profile screen / account management UI; sharing/social.

---

## 5. CI notes (important)

- Jobs: `lint`, `typecheck`, `test` (+ GitGuardian). All green on `main`.
- **`test` runs only `logic`/`models`/`shared`** (the pure-TS core) via
  `TEST_PACKAGES="logic models shared" yarn test`. The client RN suite is skipped
  in CI because the stale-lockfile `node_modules` can't resolve the RN UI stack
  under Jest. After Phase V step 1, drop the `TEST_PACKAGES` override so CI runs the
  full `yarn test`, and re-enable `push`/`pull_request` triggers in
  `.github/workflows/ci.yml` (currently `workflow_dispatch` only).
- Gotcha already solved: invoke tests via the root `yarn test` (test.sh), not
  `yarn workspace <pkg> test` directly — Yarn 3 only exposes a workspace's own
  dependency binaries, so a direct call gives `command not found: jest`.
- The client Jest setup uses `{ virtual: true }` native-module mocks
  (`jest.setup.js`) so suites can run without the real native deps installed.

---

## 6. Workflow / repo conventions

- **Dev branch:** `claude/latest-repo-changes-vip5ss` (currently reset onto merged
  `main` @ `2af3da2`). Merged PRs are final; start follow-up work fresh off `main`.
- **Merges:** repo disallows merge commits → use **squash**.
- Monorepo: Yarn 3 (Berry), `nodeLinker: node-modules`, Corepack. Packages:
  `client` (RN app), `logic`, `models`, `shared`. (The Express `server` package was
  deleted — backend is Supabase.)
- Build is **authored, not device-tested** except the C++ core (host-verified).

---

## 7. Suggested next steps (when you resume)

1. **Phase V** (a few hours on a Mac): regenerate the lockfile, `pod install` +
   Xcode wiring, Gradle, provision Supabase, boot on a device. This turns the
   scaffold into a running app and flips CI fully green incl. the client suite.
2. Then knock out the deferred cleanups (§4 items 1–4) — small, CI-validatable.
3. Then build the **reference-tone / target-melody** feature — it's the missing
   half of the product loop (sing *against* a target), and the scoring path
   already supports it.
