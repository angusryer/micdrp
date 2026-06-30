# micdrp — Architecture

> See also: [NATIVE_BUILD_PLAN.md](./NATIVE_BUILD_PLAN.md) (authoritative spec),
> [NATIVE_SETUP.md](./NATIVE_SETUP.md) (Phase V runbook),
> [DEPLOYMENT.md](./DEPLOYMENT.md) (signing + release ops).

---

## 1. Guiding Principle

> **PCM frames must never cross the React JS thread, and the moving pitch line must
> never be blocked by JS.**

Every architectural decision flows from this one rule.

---

## 2. Data-Flow Diagram

```
Microphone (hardware)
        │
        │  raw PCM (Float32, stereo → mono)
        ▼
┌──────────────────────────────────────┐
│  Platform audio capture              │  real-time audio thread
│  iOS:  AVAudioEngine installTap      │
│  Android: Oboe AudioStreamCallback  │
└──────────────────┬───────────────────┘
                   │  Float32 frames
                   │  (push into RingBuffer — lock-free, no allocation)
                   ▼
┌──────────────────────────────────────┐
│  C++ MPM — cpp/dsp/                  │  analysis worker thread (Tier 1 canonical)
│  PitchEngine::tryAnalyze()           │
│  • RingBuffer::read() → frame        │
│  • Mpm::detect() — NSDF autocorr,   │
│    per-hump peak pick, parabolic     │
│    interpolation, clarity threshold  │
│  • frequencyToNote() → midi, cents   │
│  → PitchSample { timestampMs,        │
│      frequencyHz, clarity,           │
│      midi, cents }                   │
│                                      │
│  Tier 2 fallback (no native module): │
│  react-native-audio-api AudioWorklet │
│  runs logic/mpm.ts detectPitch()     │
│  on the worklet runtime (off JS)     │
└──────────────────┬───────────────────┘
                   │  PitchSample (throttled ≤ 60 Hz)
                   │  JSI / RCTEventEmitter
                   ▼
┌──────────────────────────────────────┐
│  AudioEngine.ts wrapper              │  JS thread (singleton, event hub)
│  • Tier 1: NativeEventEmitter        │
│  • Tier 2: worklet postMessage       │
│  • fires onPitch(cb) subscribers     │
└──────────────────┬───────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
  Reanimated          XState recording
  shared value        machine (coarse)
  (pitchSv)          idle → recording
          │           → analyzing → result
          │
          ▼ (UI thread, 60/120 fps — never blocked by JS)
  @shopify/react-native-skia
  PitchLine.tsx (Skia Canvas)
  NoteRibbon.tsx
          │
          │  on stop()
          ▼
  RecordingHandle { id, uri, sampleRateHz,
                    durationMs, samples: PitchSample[] }
          │
          ▼
  Offline pipeline (logic package, JS thread — post-recording only):
  smoothPitch(samples) → segmentNotes() → NoteEvent[]
                                        → notesToMidi()  → Uint8Array (.mid)
                                        → scorePitch()   → PitchScore
          │
          ▼
  ResultsScreen: NoteList, ScoreCard, ExportSheet
  (react-native-fs writes .mid; react-native-share shares it)
          │
          ▼
  LibraryScreen: reads MMKV index + fs paths
  PlaybackBar: react-native-audio-api playback
```

**React state** (`useState` / XState) is only touched for coarse transitions
(`idle → recording → analyzing → result`). The per-frame pitch value lives
exclusively in a Reanimated shared value and is rendered by Skia on the UI
thread.

---

## 3. Three-Tier DSP Model

| Tier | Where MPM runs | Thread | When active |
|---|---|---|---|
| **1 — C++ core (canonical)** | `cpp/dsp/` compiled into the native module | real-time audio callback + analysis worker | production — ~8× faster than JS, no GC |
| **2 — JS worklet** | `react-native-audio-api` `AudioWorkletNode` running `logic` `detectPitch` | audio worklet runtime (off JS thread) | fallback when native module is absent |
| **3 — JS thread** | `logic` `detectPitch` on the JS thread | React JS thread | **forbidden on the hot path** — tests/tools only |

All three tiers emit the same `PitchSample` shape defined in
`src/audio/contract.ts`. The app (via `AudioEngine.ts`) always sees the same
interface regardless of which tier is active.

The C++ core is a mechanical port of `packages/logic/src/mpm.ts` +
`packages/logic/src/notes.ts`. The TS versions are the **golden oracle**; a
host-side C++ parity test (`cpp/dsp/__tests__/parity_test.cpp`) asserts
agreement within 1e-4 Hz (frequency) and 1 cent (note math).

---

## 4. Package Map

```
micdrp/
├── packages/
│   ├── client/                 WP-FOUNDATION, WP-AUDIO-BRIDGE, WP-RECORD-UI,
│   │   │                       WP-RESULTS-UI, WP-LIBRARY-UI, WP-SETTINGS-UI,
│   │   │                       WP-STATE, WP-PERSIST, WP-DEPLOY, WP-DSP-CORE
│   │   ├── src/
│   │   │   ├── audio/
│   │   │   │   ├── contract.ts            — shared type surface (PitchSample,
│   │   │   │   │                            AudioEngine, RecordingHandle, EngineConfig)
│   │   │   │   ├── AudioEngine.ts         — TS wrapper; selects Tier 1 or Tier 2
│   │   │   │   ├── useAudioEngine.ts      — React hook over the singleton
│   │   │   │   └── worklet/
│   │   │   │       └── pitchProcessor.ts  — Tier-2 AudioWorklet (logic detectPitch)
│   │   │   ├── state/
│   │   │   │   ├── recordingMachine.ts    — XState v4: idle→recording→analyzing→result
│   │   │   │   └── sessionMachine.ts      — app lifecycle
│   │   │   ├── screens/
│   │   │   │   ├── Record/                — live pitch UI (Skia + Reanimated hot path)
│   │   │   │   ├── Results/               — offline pipeline, score, export
│   │   │   │   ├── Library/               — recording history + playback
│   │   │   │   └── Settings/              — EngineConfig overrides + theme
│   │   │   ├── data/
│   │   │   │   ├── store.ts               — MMKV wrapper
│   │   │   │   ├── recordings.ts          — CRUD over Recording metadata
│   │   │   │   └── files.ts               — fs paths (audio, .mid blobs)
│   │   │   ├── navigation/
│   │   │   │   ├── RootNavigator.tsx
│   │   │   │   └── types.ts               — RootStackParamList, MainTabParamList
│   │   │   ├── theme/
│   │   │   └── app/
│   │   │       └── providers.tsx
│   │   ├── cpp/
│   │   │   └── dsp/                       — WP-DSP-CORE (Tier-1 C++17)
│   │   │       ├── mpm.{h,cpp}            — NSDF pitch detector (ports logic/mpm.ts)
│   │   │       ├── notes.{h,cpp}          — freq↔midi math (ports logic/notes.ts)
│   │   │       ├── ring_buffer.{h,cpp}    — lock-free SPSC ring
│   │   │       ├── pitch_engine.{h,cpp}   — composes above; owns real-time contract
│   │   │       ├── CMakeLists.txt
│   │   │       └── __tests__/
│   │   │           ├── parity_test.cpp
│   │   │           └── fixtures.json      — golden values from TS oracle
│   │   ├── ios/                           — WP-AUDIO-BRIDGE iOS side
│   │   │   ├── micdrp/
│   │   │   │   ├── AudioEngineModule.{h,mm}
│   │   │   │   ├── Info.plist             — NSMicrophoneUsageDescription
│   │   │   │   └── exportOptions.plist
│   │   │   └── Podfile
│   │   ├── android/                       — WP-AUDIO-BRIDGE Android side
│   │   │   └── app/src/main/
│   │   │       ├── AndroidManifest.xml    — RECORD_AUDIO permission
│   │   │       ├── java/com/micdrp/
│   │   │       │   └── AudioEngineModule.java
│   │   │       └── cpp/
│   │   │           └── audio_jni.cpp
│   │   └── fastlane/                      — WP-DEPLOY
│   │       ├── Fastfile
│   │       ├── Appfile
│   │       └── Matchfile
│   ├── logic/                             — pure-TS DSP pipeline (the golden oracle)
│   │   └── src/
│   │       ├── mpm.ts                     — detectPitch (NSDF + MPM)
│   │       ├── notes.ts                   — frequencyToNote/frequencyToMidi/midiToFrequency
│   │       ├── smoothing.ts               — smoothPitch (median filter + clarity gate)
│   │       ├── segmentation.ts            — segmentNotes → NoteEvent[]
│   │       ├── midi.ts                    — notesToMidi → Uint8Array
│   │       └── scoring.ts                 — scorePitch → PitchScore
│   └── models/                            — domain types
│       └── src/
│           ├── pitch.ts                   — PitchSample (domain mirror of contract)
│           └── recording.ts               — Recording, RecordingStatus
├── scripts/
│   ├── release-ios.sh
│   ├── release-android.sh
│   └── bump-version.sh
└── .github/
    └── workflows/
        ├── ci.yml
        ├── release-ios.yml                — workflow_dispatch only
        └── release-android.yml            — workflow_dispatch only
```

---

## 5. Offline Pipeline Reuse

On `stop()`, the native engine returns a `RecordingHandle` whose `samples`
array contains every `PitchSample` emitted during the session at full
resolution (unthrottled). The app then runs the complete `packages/logic`
pipeline over it:

```ts
import { smoothPitch, segmentNotes, notesToMidi, scorePitch } from 'logic';

// PitchSample is structurally identical to logic's PitchFrame — no conversion needed.
const smoothed  = smoothPitch(handle.samples, { windowSize: 5, minClarity: 0.85 });
const notes     = segmentNotes(smoothed, { minDurationMs: 60, maxGapMs: 40 });
const midiBytes = notesToMidi(notes, { bpm: 120 });
const score     = scorePitch(smoothed, targetNotes);
```

The logic package is pure TS with no native or filesystem dependencies. It
runs identically in Jest (all offline-pipeline tests), in the Results screen,
and as the Tier-2 worklet oracle. **The C++ core is validated against its
output** — there is exactly one implementation of MPM/notes, used in three
places.

---

## 6. Cross-Package Contract

All packages code against `packages/client/src/audio/contract.ts`. No type is
duplicated. Imports flow in one direction:

```
screens / hooks / machines
    ↓  import from
src/audio/contract.ts  ←  logic (PitchFrame compatible)  ←  models
    ↓  implemented by
src/audio/AudioEngine.ts  (selects Tier 1 or Tier 2)
    ↓  backed by
cpp/dsp/  (Tier 1)  or  worklet/pitchProcessor.ts  (Tier 2)
```

---

## 7. Work Package Index

| WP | Scope | Key files |
|---|---|---|
| WP-FOUNDATION | deps, contract, app shell, navigation skeleton | `package.json`, `src/audio/contract.ts`, `App.tsx`, `src/navigation/*`, `src/theme/*`, `Info.plist`, `AndroidManifest.xml` |
| WP-DSP-CORE | Tier-1 C++ pitch engine | `cpp/dsp/*` |
| WP-AUDIO-BRIDGE | native modules + TS wrapper | `ios/AudioEngineModule.*`, `android/.../AudioEngineModule.java`, `src/audio/AudioEngine.ts`, `src/audio/worklet/*` |
| WP-RECORD-UI | live record screen (Skia + Reanimated) | `src/screens/Record/*` |
| WP-RESULTS-UI | analysis, score, export | `src/screens/Results/*` |
| WP-LIBRARY-UI | history + playback | `src/screens/Library/*` |
| WP-SETTINGS-UI | settings + engine tuning | `src/screens/Settings/*` |
| WP-STATE | XState machines | `src/state/*` |
| WP-PERSIST | MMKV + fs storage | `src/data/*` |
| WP-DEPLOY | fastlane + release workflows | `fastlane/*`, `scripts/release-*.sh`, `.github/workflows/release-*.yml` |
| WP-DOCS | this file + NATIVE_SETUP + DEPLOYMENT | `docs/ARCHITECTURE.md`, `docs/NATIVE_SETUP.md`, `docs/DEPLOYMENT.md` |
| WP-SYNTH | reconciliation (runs last) | cross-imports, barrel exports |
