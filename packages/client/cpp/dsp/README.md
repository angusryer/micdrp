# micdrp DSP core (`cpp/dsp/`) — Tier-1 shared C++ pitch engine

This is the **canonical, real-time pitch detector** for micdrp (see
`docs/NATIVE_BUILD_PLAN.md` §0). It is a **mechanical, dependency-free C++17
port** of the pure-TS reference in `packages/logic`:

| C++ here | Ports from `packages/logic/src/` | What it is |
|---|---|---|
| `mpm.{h,cpp}` → `Mpm` | `mpm.ts` (`detectPitch`) | NSDF type-II autocorrelation, per-hump peak pick, parabolic interpolation, clarity threshold, min/max frequency bounds |
| `notes.{h,cpp}` → `frequencyToMidi`, `frequencyToNote`, `midiToFrequency` | `notes.ts` | pitch ⇄ note / cents math |
| `ring_buffer.{h,cpp}` → `RingBuffer` | (new) | lock-free SPSC float ring for the audio thread |
| `pitch_engine.{h,cpp}` → `PitchEngine` | composes the above + `contract.ts` `PitchSample` | owns ring + `Mpm`; `push(samples)` (real-time safe) → `tryAnalyze()` → `PitchSample` |

Defaults mirror `src/audio/contract.ts` `DEFAULT_ENGINE_CONFIG`
(44100 Hz, frame 2048, hop 1024, min 70 Hz, max 1200 Hz, clarity 0.9, 60 Hz emit).

The TS version stays the **golden oracle**: the host parity test pins this C++
to the TS output within **1e-4 Hz** (frequency) and **1 cent** (note math).
There is one source of truth for the algorithm; production just runs the fast
copy off the React JS thread.

## How the core maps to `logic`

* `Mpm::detect(frame, n)` is a line-for-line port of `detectPitch`. NSDF is
  accumulated in `double` and stored in a `float` buffer, exactly mirroring the
  TS `Float32Array` — that narrowing is what keeps peak-picking bit-identical.
* The unvoiced sentinel differs by representation only: TS returns
  `{ frequency: null }`; C++ returns `{ frequencyHz: 0, voiced: false }`, to
  match the `PitchSample` wire contract (`frequencyHz === 0`, `midi`/`cents`
  `null` when unvoiced). The native bridge maps `!voiced → midi/cents = null`.
* `frequencyToNote` returns the `{ midi, cents }` subset of `logic`'s
  `NoteReading`. `name`/`octave` are derivable on the JS side from `midi` and
  are not part of the wire payload, so they are intentionally omitted.
* `PitchEngine` emits a `PitchSample` shaped exactly like
  `src/audio/contract.ts` `PitchSample`
  (`timestampMs / frequencyHz / clarity / midi / cents`). On stop, the app runs
  the rest of the `logic` pipeline (`smoothPitch → segmentNotes → notesToMidi /
  scorePitch`) over the collected `PitchSample[]`.

## Real-time contract

* `configure()` is called **off** the audio thread; it pre-sizes all scratch so
  the hot path never allocates.
* `push(samples, count)` is **real-time safe** — lock-free, no allocation, no
  blocking — and is the only thing the audio capture callback (AVAudioEngine tap
  / Oboe) calls. **PCM never crosses into JS.**
* `tryAnalyze()` runs on a consumer/worker thread, slides a `frameSize` window
  forward by `hopSize` (50% overlap by default), runs MPM + note math, and
  returns a `PitchSample`. The bridge throttles these to ≤ `emitRateHz` before
  emitting to JS.
* `RingBuffer` is strictly single-producer (audio callback) /
  single-consumer (analysis pump). Acquire/release atomics publish sample
  writes before the index advance — no mutex on the audio path.

## Build & run the parity test (on a dev box / CI with a C++ toolchain)

The DSP core is STL-only, so the host test needs nothing but a C++17 compiler.

With CMake (also registers a `ctest`):

```sh
cd packages/client/cpp/dsp
cmake -S . -B build && cmake --build build
ctest --test-dir build --output-on-failure   # or: ./build/dsp_parity_test
```

Without CMake (one-liner):

```sh
cd packages/client/cpp/dsp
c++ -std=c++17 -O2 -Wall -Wextra -Wpedantic -I. \
    mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
    __tests__/parity_test.cpp -o dsp_parity_test
./dsp_parity_test     # prints "PARITY OK", exit 0
```

The test (`__tests__/parity_test.cpp`) asserts, against the golden values in
`__tests__/fixtures.json`:

* MPM detects 110/220/440/660 Hz sines within **1e-4 Hz** and matching clarity;
* min/max frequency bounds reject out-of-range sines; silence is unvoiced;
* `frequencyToNote` midi/cents match `notes.ts` within **1 cent**;
* `midiToFrequency`/`frequencyToMidi` round-trip A4;
* `PitchEngine` streams `PitchSample`s with monotonic timestamps that land on
  the correct note.

### Regenerating the golden fixtures

`fixtures.json` (and the constants embedded in `parity_test.cpp`) are emitted by
running the **TS oracle** — the exact `mpm.ts` / `notes.ts` code — over the same
sine inputs and recording its outputs. Regenerate when the TS algorithm changes:
replicate `detectPitch` + `frequencyToNote` over 2048-sample sines at 44100 Hz
(110/220/440/660 Hz) preserving `Float32Array` storage, dump
`{ frequency, clarity, midi, cents }`, and paste the numbers into both files.
The whole point is that these numbers come from the TS reference, so the test
pins C++ → TS rather than C++ → itself.

## How iOS / Android consume this

These files are **plain portable C++** — no RN, JNI, or Objective-C here. The
platform bridges (owned by **WP-AUDIO-BRIDGE**) compile them into the native
module and call the same API:

* **iOS** (`ios/AudioEngineModule.{h,mm}`): add `cpp/dsp/*.cpp` to the Xcode
  target (or a small podspec). The AVAudioEngine input tap's render callback
  calls `PitchEngine::push(...)` on the audio thread; a drain loop calls
  `tryAnalyze()` and forwards `PitchSample`s via the event emitter / JSI.
* **Android** (`android/app/src/main/cpp/`): list `cpp/dsp/*.cpp` in the app's
  `CMakeLists.txt` (e.g. `../../../../cpp/dsp/`). The Oboe/AudioRecord callback
  calls `push(...)`; a worker calls `tryAnalyze()` and forwards samples over JNI
  to the Java `AudioEngineModule`.

Both platforms share **this one** implementation, validated by **this one**
parity test — keeping a single source of truth across TS, iOS, and Android.
```
