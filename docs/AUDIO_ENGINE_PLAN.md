# micdrp — Real-Time Audio Engine: Implementation Plan

> **Goal:** make micdrp's core singing → pitch → MIDI pipeline *super performant* on
> mobile, and fill in the architecture that is currently scaffolded but unbuilt.

## TL;DR

- **Foundation:** adopt [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api)
  (Software Mansion, MIT) as the audio engine — C++ core, microphone capture, custom
  audio worklets, analysis, and playback in one Web Audio–compatible package.
- **Performance principle:** raw PCM frames never round-trip through the React JS
  thread, and the pitch-line UI is never blocked by JS.
  - Capture in C++ (`AudioRecorder`).
  - Run pitch detection (**MPM**) in a **custom audio worklet / C++ processor**, off the
    React JS thread.
  - Pass only a tiny `{ pitchHz, confidence, note }` payload to the app via JSI.
  - Animate the pitch line with **Reanimated shared values** on the UI thread (60/120fps).
- **Drop** the dead `react-native-audio-cortex` `workspace:*` dependency — the engine
  replaces the native module we would otherwise have had to build.
- **Prerequisite:** upgrade React Native and enable the **New Architecture**
  (Fabric/TurboModules). This is the mechanism that delivers the JSI/worklet
  performance, so it is step 0, not a detour.

---

## 1. Why this architecture

For a real-time pitch app, "super performant" reduces to one rule:

> **PCM audio frames must never cross the React JS thread, and rendering of the moving
> pitch line must never be blocked by JS execution.**

Two findings drive the decision:

1. **Compiled DSP is ~8× faster than pure JS** for pitch detection, and naive
   JS-thread DSP at frame rate risks dropped frames / GC stalls. `@dr.pogodin/react-native-audio`'s
   own docs warn that its JS chunk callback will **crash the app with OOM** if it cannot
   keep up — which is exactly the bottleneck we must avoid.
2. The performant path is **native/worklet DSP → JSI result → UI-thread animation**.

`react-native-audio-api` provides every piece to honor that rule in a single
MIT-licensed, actively maintained C++ engine. `@dr.pogodin/react-native-audio` was the
runner-up but is capture-only and pushes all data into a JS callback — the wrong layer
for maximum performance.

### Data flow

```
Mic ──► AudioRecorder (C++ capture, off-bridge)
         │
         ▼
   Custom Audio Worklet / C++ processor    ← MPM pitch detection runs HERE (off JS thread)
         │   PCM frames in, pitch out
         ▼
   { pitchHz, confidence, note }            ← tiny payload via JSI
         │
         ▼
   Reanimated shared value ──► pitch-line UI on the UI thread @ 60/120fps
```

Reference tones / backing tracks play through the **same** audio graph, which also
removes the ~5.6s `SamplePlayer` limit that the Pogodin route would have imposed.

---

## 2. How it maps onto the monorepo

| Package | Today | After this plan |
|---|---|---|
| `client` | skeleton `App.tsx`, decorative XState machine | audio graph + worklet wiring, Reanimated pitch viz, XState machine *actually* driving `idle → recording → analyzing → result` |
| `logic` | `export const test = 'test'` | **MPM** pitch detection + pitch→note/MIDI conversion — pure TS, Jest-tested, worklet-safe (and portable to C++) |
| `models` | empty stub | `PitchSample`, `Note`, `Recording` types incl. clarity/accuracy metadata |
| `server` | `/status` only | unchanged for now; later: recording storage + AI feedback |
| `react-native-audio-cortex` | dangling `workspace:*` | **deleted** |

**Algorithm:** **MPM (McLeod Pitch Method)**, chosen over YIN for monophonic *singing* —
its NSDF clarity score feeds micdrp's "vocal clarity" metadata goal directly. If the
worklet version needs more headroom on low-end devices, the MPM core ports to C++
(e.g. [`sevagh/pitch-detection`](https://github.com/sevagh/pitch-detection)) with no
architectural change, since the engine is already C++.

**Through-line:** this is the Web Audio API model — the same API micdrp-web's 2020
prototype used (`AnalyserNode` over a mic `audioStream`). The original DSP concepts carry
over.

---

## 3. Phased delivery

### Phase 0 — New Architecture enablement *(prerequisite)*
- Upgrade React Native from 0.72 to a New-Architecture-ready release.
- Enable Fabric / TurboModules (`newArchEnabled` on Android, `RCT_NEW_ARCH_ENABLED` pods on iOS).
- Re-run the full Jest + typecheck + lint suite; fix breakages from the bump.
- **Exit criteria:** app builds and boots on iOS + Android with New Arch on; CI green.

### Phase 1 — Engine swap
- Remove `react-native-audio-cortex` from `packages/client/package.json` and the
  `App.tsx` placeholder comments.
- Add `react-native-audio-api` (+ `react-native-reanimated` if not already wired for the UI thread).
- Configure mic permissions (iOS `NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`)
  across the dev/staging/prod schemes.
- **Exit criteria:** `AudioRecorder` starts/stops and logs frame metadata on a device.

### Phase 2 — Capture → worklet → Reanimated spike
- Stand up the audio graph: `AudioRecorder.onAudioReady` → worklet → shared value.
- Draw a live pitch line driven entirely by a Reanimated shared value (no React re-renders
  on the hot path).
- Use a placeholder/naive detector first to validate **latency and threading**, not accuracy.
- **Exit criteria:** smooth live pitch line with input→display latency within target
  (define a concrete budget here, e.g. < ~30 ms) and no JS-thread jank.

### Phase 3 — Real DSP in `logic` + types in `models`
- Implement **MPM** in `packages/logic` as a pure function: `Float32Array` frame →
  `{ pitchHz, clarity }`. Unit-test against synthetic tones + recorded vocal fixtures.
- Implement pitch→note conversion (Hz → MIDI note number + cents deviation).
- Define `PitchSample`, `Note`, `Recording` in `packages/models`.
- Wire the `logic` detector into the Phase 2 worklet.
- **Exit criteria:** accurate, stable note read-out on sung notes; tests green.

### Phase 4 — MIDI export + session capture
- Accumulate `PitchSample`s into notes (onset/offset + duration) and export Standard MIDI,
  embedding pitch-accuracy / clarity metadata.
- Persist a recording session (local first).
- **Exit criteria:** record → analyze → export a `.mid` that opens in a DAW.

### Later (out of scope for this plan)
- Server-side analysis endpoints, auth (revive the commented `Interceptor.tsx` properly),
  storage, and the AI feedback/pattern-recognition layer.

---

## 4. Risks & decisions to revisit

- **RN upgrade blast radius (Phase 0)** is the largest single cost and gates everything
  else. If it proves too disruptive, fall back to a capture + JS-DSP MVP to de-risk the
  *product* while the upgrade lands on a side branch — explicitly accepting lower
  performance as temporary.
- **Worklet vs C++ for MPM:** start in the worklet (TS). Only drop to C++ if profiling on
  low-end hardware demands it. Keep the `logic` MPM function pure so the port is mechanical.
- **Latency budget** must be defined as a concrete number before Phase 2 sign-off so
  "performant" is measurable, not vibes.
- **Engine version:** `react-native-audio-api` is pre-1.0 (0.12.x). Pin the version and
  track its API churn.

---

## 5. Immediate next actions

1. Confirm the target RN version for Phase 0.
2. Set the input→display latency budget (the Phase 2 exit number).
3. Begin Phase 1 engine swap on `claude/latest-repo-changes-vip5ss`.
