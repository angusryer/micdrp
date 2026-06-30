# micdrp — Native Build Plan (Batchable Work Breakdown)

> **Purpose.** Take micdrp from "complete, tested pure-TS DSP core + stub native
> shell" to a **complete, deployable React Native app**. This document is the
> authoritative spec and the **work-package breakdown** intended to be handed to a
> batch of parallel agents. Each work package (WP) below is self-contained: scope,
> the exact files it owns, the contract it codes against, and its acceptance bar.
>
> **Reality check.** This work is authored in a Linux CI sandbox that **cannot build
> iOS/Android or run a device**. Everything here is written to be *coherent and
> buildable on a Mac/Android dev machine*, validated by typecheck/lint/Jest where
> possible, but **not device-tested**. Treat the first real `pod install` + Gradle
> sync + device boot as Phase V (Validation), to be done by a human on real hardware.

---

## 0. Architecture decision — where audio analysis lives

**Decision: the canonical pitch detector is a shared C++ DSP core, run on the
real-time audio thread, never on the React JS thread. The pure-TS `logic` MPM is
retained as the reference oracle and the worklet fallback.**

Rationale (the one rule that defines "performant" for a real-time pitch app):

> **PCM frames must never cross the React JS thread, and the moving pitch line must
> never be blocked by JS.**

Three tiers, fastest first. We **ship Tier 1 as canonical** and keep Tier 2 wired as
a drop-in fallback:

| Tier | Where MPM runs | Thread | Use |
|---|---|---|---|
| **1 — C++ core (canonical)** | `cpp/dsp/` compiled into the native module | real-time audio callback (AVAudioEngine tap / Oboe) | production hot path; ~8× faster than JS, no GC |
| **2 — JS worklet** | `react-native-audio-api` `AudioWorkletNode` running `logic` `detectPitch` | audio worklet runtime (off JS thread) | fallback / fast iteration / devices without the C++ path |
| **3 — JS thread** | `logic` on the JS thread | React JS thread | **forbidden on the hot path**; tests/tools only |

The C++ core is a **mechanical port** of `packages/logic/src/mpm.ts` +
`notes.ts` (both already pure and ES5-safe). The TS versions become the **golden
reference**: a host-side test compiles the C++ with the same fixture inputs and
asserts parity with the TS output (within float tolerance). This keeps one source of
truth for the algorithm while running the fast copy in production.

**Output contract (all tiers emit the same payload):** a tiny `PitchSample`
(`{ timestampMs, frequencyHz, clarity, midi, cents }`) pushed to JS at a throttled
event rate (≤ ~60 Hz). Raw PCM never leaves native.

**UI:** `PitchSample` → Reanimated shared value → Skia pitch line on the UI thread.
React re-renders only on coarse state transitions (`idle → recording → analyzing →
result`), never per frame.

```
Mic ─► native capture (AVAudioEngine / Oboe, C++)
        │  Float32 frames, real-time thread
        ▼
   C++ MPM (cpp/dsp)  ── Tier 1 canonical ──┐   (Tier 2: audio-api worklet running logic)
        │  {hz,clarity,midi,cents}          │
        ▼                                    ▼
   JSI / event emitter (throttled ≤60Hz) ──► JS
        │
        ▼
   Reanimated shared value ─► Skia pitch line (UI thread, 60/120fps)
        │
        ▼  (on stop)
   logic pipeline: smoothPitch → segmentNotes → notesToMidi / scorePitch
```

---

## 1. Target stack

| Concern | Choice | Notes |
|---|---|---|
| RN | 0.72 → **0.74.x** (New Arch on) | repo is already New-Arch-scaffolded; bump is Phase 0 |
| Audio capture/graph | `react-native-audio-api` (Software Mansion, MIT) | recorder + worklets + analyser + playback |
| UI-thread animation | `react-native-reanimated` v3 | shared values drive the pitch line |
| Pitch visualisation | `@shopify/react-native-skia` | GPU-drawn live pitch line + note ribbon |
| Navigation | `@react-navigation/native` + `native-stack` | |
| State | **XState v4** (already installed) + `@xstate/react` | keep v4 to match existing `machine.ts`; new machines: `recording`, `session`, `app` |
| Persistence | `react-native-mmkv` (metadata/index) + `react-native-fs` (audio + `.mid` blobs) | |
| Sharing/export | `react-native-share` | share exported `.mid` |
| Native DSP | shared **C++17** in `packages/client/cpp/dsp/` | JSI install via a TurboModule/bridge |

> **Lockfile note.** Versions are specified in WP-FOUNDATION's `package.json`. The
> actual resolution + `yarn.lock` update **must happen on a machine with working npm
> egress** (the sandbox cannot fetch tarballs). Each agent assumes deps are present.

---

## 2. The shared contract (every agent codes against this)

These types are committed by **WP-FOUNDATION** before any other WP starts. They are
the single integration surface; agents must not redefine them.

```ts
// packages/client/src/audio/contract.ts  (owned by WP-FOUNDATION)

/** One analysed frame emitted by the native engine (all tiers). Mirrors models.PitchSample. */
export interface PitchSample {
  timestampMs: number;
  frequencyHz: number;   // 0 when unvoiced
  clarity: number;       // 0..1 NSDF peak
  midi: number | null;   // null when unvoiced
  cents: number | null;  // -50..50 deviation
}

export interface EngineConfig {
  sampleRateHz: number;      // default 44100
  frameSize: number;         // analysis window, default 2048
  hopSize: number;           // default 1024
  minFrequencyHz: number;    // default 70
  maxFrequencyHz: number;    // default 1200
  clarityThreshold: number;  // default 0.9
  emitRateHz: number;        // throttle to JS, default 60
}

export type EngineState = 'idle' | 'recording' | 'analyzing' | 'error';

/** The TS surface of the native module (TurboModule-shaped). */
export interface AudioEngine {
  configure(config: Partial<EngineConfig>): Promise<void>;
  start(): Promise<void>;            // begins capture + analysis
  stop(): Promise<RecordingHandle>;  // returns the captured session handle
  requestPermission(): Promise<boolean>;
  /** Subscribe to throttled PitchSample stream. Returns an unsubscribe fn. */
  onPitch(cb: (s: PitchSample) => void): () => void;
  onState(cb: (s: EngineState) => void): () => void;
}

/** Reference to a finished capture (audio file on disk + the analysed frames). */
export interface RecordingHandle {
  id: string;
  uri: string;            // file:// path to captured wav/m4a
  sampleRateHz: number;
  durationMs: number;
  samples: PitchSample[]; // full-resolution analysis (not throttled)
}
```

Domain types (`PitchFrame`, `NoteEvent`, `TargetNote`, `PitchScore`, etc.) come
straight from `packages/logic` and `packages/models` — **import, never duplicate**.
`PitchSample` is structurally compatible with logic's `PitchFrame`.

The full offline pipeline already exists in `packages/logic`:
`detectPitch → frequencyToNote → smoothPitch → segmentNotes → notesToMidi`, plus
`scorePitch`. Native Tier-1/2 produce the live `PitchSample` stream; on stop, the app
runs `smoothPitch → segmentNotes → notesToMidi`/`scorePitch` over `samples`.

---

## 3. Work packages (the batch)

Dependency order: **WP-FOUNDATION** first (blocks all). Then **everything else runs in
parallel** — paths are disjoint, so no write conflicts. **WP-SYNTH** runs last to
reconcile cross-references.

### WP-FOUNDATION — spine & contracts *(blocks all; do first, single-threaded)*
- **Owns:** `packages/client/package.json` (deps), `src/audio/contract.ts`,
  `src/theme/*`, `src/navigation/*` (route types + navigator skeleton),
  `src/app/providers.tsx`, `App.tsx` rewrite, iOS `Info.plist` mic permission,
  Android `AndroidManifest.xml` mic permission, `babel.config.js` (reanimated plugin),
  `tsconfig`, `metro.config.js` worklet/svg tweaks.
- **Deliverable:** app compiles to a navigable shell (Splash → Record → Results →
  Library → Settings routes exist as placeholders), all contracts exported, deps
  declared. Everything else builds on this.
- **Accept:** `yarn workspace client typecheck` clean against placeholder screens;
  contract types exported and referenced by at least one placeholder.

### WP-DSP-CORE — shared C++ pitch engine *(Tier 1)*
- **Owns:** `packages/client/cpp/dsp/mpm.{h,cpp}`, `cpp/dsp/notes.{h,cpp}`,
  `cpp/dsp/ring_buffer.{h,cpp}`, `cpp/dsp/README.md`, host parity test
  `cpp/dsp/__tests__/parity_test.cpp` + a tiny CMake to build it,
  `cpp/dsp/fixtures/*.json` (shared with the TS oracle).
- **Spec:** mechanical port of `packages/logic/src/mpm.ts` (NSDF autocorrelation,
  per-hump peak pick, parabolic interpolation, clarity threshold) and `notes.ts`
  (`frequencyToMidi`/`frequencyToNote`). Same defaults. Parity test asserts C++ output
  matches the TS reference within 1e-4 Hz / 1 cent on shared fixtures.
- **Accept:** parity test documented + compilable with `cmake . && make` on a dev box.

### WP-AUDIO-BRIDGE — native module + JS wrapper *(implements AudioEngine)*
- **Owns:** iOS `ios/AudioEngineModule.{h,mm}` (AVAudioEngine tap → C++ MPM →
  RCTEventEmitter/JSI), Android
  `android/app/src/main/java/com/micdrp/AudioEngineModule.java` + JNI glue
  `android/app/src/main/cpp/audio_jni.cpp` + `CMakeLists.txt` additions (Oboe or
  AudioRecord → C++ MPM), `src/audio/AudioEngine.ts` (TS wrapper implementing the
  `AudioEngine` contract over the native module / event emitter),
  `src/audio/worklet/pitchProcessor.ts` (Tier-2 audio-api worklet running `logic`),
  `src/audio/useAudioEngine.ts` hook, `src/audio/__tests__/*` (mock-native unit tests).
- **Spec:** TS wrapper is the only thing the app imports; it picks Tier 1 if the native
  module is present, else Tier 2 worklet. Emits throttled `PitchSample` per the contract.
  Keep `AudioControlModule` (legacy stub) untouched or fold its `testLog` in.
- **Accept:** `AudioEngine.ts` typechecks against the contract; Jest unit tests pass
  with a mocked native module + emitter.

### WP-RECORD-UI — live record screen *(the hot path UI)*
- **Owns:** `src/screens/Record/RecordScreen.tsx`,
  `src/screens/Record/PitchLine.tsx` (Skia + Reanimated shared value),
  `src/screens/Record/NoteRibbon.tsx`, `src/screens/Record/TransportBar.tsx`,
  `src/screens/Record/useRecordController.ts` (binds `useAudioEngine` + recording
  machine to shared values), `src/screens/Record/__tests__/*`.
- **Spec:** subscribe to the engine pitch stream, write to a Reanimated shared value,
  render the live pitch line on the UI thread. No React state on the per-frame path.
  Start/stop drives the `recording` machine (WP-STATE). On stop, navigate to Results
  with the `RecordingHandle`.
- **Accept:** typechecks; component renders under Jest with mocked engine/Skia.

### WP-RESULTS-UI — analysis, score, export
- **Owns:** `src/screens/Results/ResultsScreen.tsx`,
  `src/screens/Results/NoteList.tsx`, `src/screens/Results/ScoreCard.tsx`,
  `src/screens/Results/ExportSheet.tsx`, `src/screens/Results/useResults.ts`
  (runs `smoothPitch → segmentNotes → notesToMidi`/`scorePitch` from `logic`,
  writes `.mid` via fs, shares via react-native-share), `__tests__/*`.
- **Accept:** typechecks; `useResults` unit-tested against `logic` with fixture samples
  (real logic, mocked fs/share).

### WP-LIBRARY-UI — history & playback
- **Owns:** `src/screens/Library/LibraryScreen.tsx`,
  `src/screens/Library/RecordingCard.tsx`,
  `src/screens/Library/PlaybackBar.tsx` (audio-api playback),
  `src/screens/Library/useLibrary.ts` (reads persistence), `__tests__/*`.
- **Accept:** typechecks; list renders from a mocked persistence store.

### WP-SETTINGS-UI — settings & engine tuning
- **Owns:** `src/screens/Settings/SettingsScreen.tsx`,
  `src/screens/Settings/useSettings.ts` (persisted `EngineConfig` overrides + theme),
  `__tests__/*`.
- **Accept:** typechecks; settings round-trip through a mocked store.

### WP-STATE — XState machines
- **Owns:** `src/state/recordingMachine.ts` (`idle → requestingPermission →
  recording → analyzing → result → idle`, error states),
  `src/state/sessionMachine.ts` (app/session lifecycle),
  `src/state/index.ts`, `src/state/__tests__/*`.
- **Spec:** XState v4 syntax (match existing `utilities/machine.ts`). Machines are pure
  (no UI imports); they orchestrate the `AudioEngine` contract via services/actions
  injected by the screens.
- **Accept:** machine transition unit tests pass.

### WP-PERSIST — storage layer
- **Owns:** `src/data/store.ts` (MMKV wrapper), `src/data/recordings.ts` (CRUD over
  `Recording` metadata + file refs), `src/data/files.ts` (fs paths for audio/`.mid`),
  `src/data/__tests__/*`.
- **Spec:** depends only on `models.Recording` + the contract; screens consume it via
  hooks. Provide an in-memory mock for tests.
- **Accept:** CRUD unit-tested against the MMKV mock.

### WP-DEPLOY — deployment scripts
- **Owns:** `packages/client/fastlane/Fastfile` (+ `Appfile`, `Matchfile`),
  `packages/client/fastlane/README.md`, `scripts/release-ios.sh`,
  `scripts/release-android.sh`, `scripts/bump-version.sh`,
  `.github/workflows/release-ios.yml`, `.github/workflows/release-android.yml`
  (both `workflow_dispatch`, matching the disabled-by-default CI policy).
- **Spec:** lanes for build/sign/upload to TestFlight + Play internal track. Read all
  secrets from env/CI secrets — **never commit credentials, keystores, or hostnames**.
  Reference the existing `.secret` files only by name.
- **Accept:** scripts are shellcheck-clean; workflows are valid YAML; no secrets in tree.

### WP-DOCS — deployment & native docs
- **Owns:** `docs/DEPLOYMENT.md` (signing setup, secrets matrix, TestFlight/Play steps,
  release runbook, rollback), `docs/NATIVE_SETUP.md` (pod install, Gradle, New Arch
  flags, mic permissions, running on device), `docs/ARCHITECTURE.md` (the data-flow +
  package map + tier model), update root `README.md` pointers.
- **Accept:** docs cross-link the WPs and match the file manifest; no secret values.

### WP-SYNTH — reconciliation *(runs last)*
- Verify every cross-import resolves, the navigator wires all real screens, providers
  mount the store + engine, and `index.ts` barrels are complete. Fix mismatches. Run
  `yarn workspace client typecheck`/`lint`/`test` mentally against the tree and patch
  obvious breaks.

---

## 4. How to dispatch this to a batch of agents

1. **Land WP-FOUNDATION first** (it blocks everything; one agent, then commit).
2. **Fan out** WP-DSP-CORE, WP-AUDIO-BRIDGE, WP-RECORD-UI, WP-RESULTS-UI,
   WP-LIBRARY-UI, WP-SETTINGS-UI, WP-STATE, WP-PERSIST, WP-DEPLOY, WP-DOCS in parallel.
   Paths are disjoint → safe concurrent writes. Each agent gets: this doc §2 (contract)
   + §3 (its WP) + "import from `logic`/`models`, never redefine; code against the
   contract; typecheck-clean; untested-on-device is acceptable."
3. **Run WP-SYNTH** to reconcile.
4. **Commit, push, open draft PR** on `claude/latest-repo-changes-vip5ss`.
5. **Phase V (human, on hardware):** resolve `yarn.lock`, `pod install`, Gradle sync,
   fix build errors, boot on device, then enable the release workflows.

## 5. Invariants for every agent
- Import domain logic from `packages/logic` / `packages/models`. Never reimplement DSP.
- Code against `src/audio/contract.ts`. Never redefine the contract types.
- Keep the per-frame path off the React JS thread (shared values / native events only).
- No secrets, keystores, tokens, or internal hostnames in committed files.
- TypeScript strict-clean; ship a Jest test alongside each non-trivial unit.
- This is bare RN (not Expo): native iOS/Android projects already exist — extend them.
