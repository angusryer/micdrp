# micdrp — Native Setup Runbook (Phase V)

> This is the **Phase V** runbook: the steps a human runs on real macOS/Linux
> hardware after the agent batch has landed code. The Linux sandbox that authored
> the app cannot build iOS/Android or run a device — everything below is written
> for a developer Mac (iOS) or a Mac/Linux machine with Android tooling.
>
> See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data-flow and package map.
> See [DEPLOYMENT.md](./DEPLOYMENT.md) for signing, secrets, and release ops.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | matches `.nvmrc` in repo root | `nvm install` or `fnm install` |
| Yarn (via Corepack) | 3.x (Berry) | see below |
| Ruby | 2.7+ | system or `rbenv install 2.7.8` |
| Bundler | 2.x | `gem install bundler` |
| CocoaPods | 1.14+ | `gem install cocoapods` (or via Bundler) |
| Xcode | 15+ | App Store |
| Android Studio | Hedgehog+ | android.com/studio |
| JDK | 17 (Temurin) | `brew install temurin17` |
| CMake | 3.22+ | Xcode CLT / Android NDK ships one |

---

## 1. Clone and Bootstrap

```sh
git clone <repo-url> micdrp
cd micdrp

# Activate the pinned Node version (reads .nvmrc):
nvm install    # or: fnm install

# Enable Corepack so Yarn 3 is available without a global install:
corepack enable

# Install all workspace dependencies (logic, models, client):
yarn install
```

`yarn install` is the only dependency-management step. Do **not** run
`npm install` or `yarn` without `install` — they behave differently under
Corepack/Berry.

---

## 2. iOS Setup

### 2a. Install Ruby gems (Fastlane + CocoaPods wrapper)

```sh
cd packages/client
bundle install     # reads Gemfile; installs fastlane, cocoapods gem
```

### 2b. Install CocoaPods

```sh
# From packages/client/:
bundle exec pod install --project-directory=ios
# or via the package.json script alias:
yarn pod
```

CocoaPods resolves the native dependencies for react-native-reanimated,
@shopify/react-native-skia, react-native-audio-api, react-native-mmkv,
react-native-fs, react-native-share, and the navigation stack.

The `Podfile` (at `packages/client/ios/Podfile`) appends `#include? "../../../env.xcconfig"`
to the generated xcconfig files so that `react-native-config` env vars are
available at build time.

After `pod install`, open the **workspace** (not the project):

```sh
open packages/client/ios/micdrp.xcworkspace
```

### 2c. New Architecture flag (iOS)

The flag is `RCT_NEW_ARCH_ENABLED`. Check the current state in Xcode:

- Open `micdrp` target → Build Settings → search `RCT_NEW_ARCH_ENABLED`.
- The `AppDelegate.mm` already contains `#if RCT_NEW_ARCH_ENABLED` guards.

To enable New Architecture, set `RCT_NEW_ARCH_ENABLED=1` in the xcconfig or
via an Xcode build setting. The Podfile uses `get_default_flags()` which reads
the environment. Alternatively, set it directly in `ios/Podfile`:

```ruby
use_react_native!(
  :path => config[:reactNativePath],
  :hermes_enabled => true,
  :fabric_enabled => true,   # enables Fabric / New Arch
  ...
)
```

Re-run `pod install` after any Podfile change.

### 2d. Microphone permission

`Info.plist` (`packages/client/ios/micdrp/Info.plist`) already contains:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>micdrp uses the microphone to capture your singing for real-time pitch analysis.</string>
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

No further action is required. The runtime permission prompt is triggered
by `audioEngine.requestPermission()` (see `src/audio/AudioEngine.ts`).

### 2e. Run on an iOS device

```sh
# Via React Native CLI (from repo root or packages/client):
yarn workspace client ios:development
# or: react-native run-ios --scheme micdrp-development --device "My iPhone"

# For a release/staging build:
yarn workspace client ios:production
```

Alternatively, select your connected device in Xcode and press Run (⌘R).

### 2f. Verify react-native-audio-api, reanimated, and Skia on iOS

After first boot:

1. **reanimated**: open the Record screen and confirm the pitch line animates
   smoothly at 60 fps without JS-thread jank. In development, the reanimated
   babel plugin logs `"Reanimated: X worklet(s) imported"` at startup.
2. **Skia**: the PitchLine canvas should render with GPU acceleration. A white
   or blank canvas means Skia's Metal renderer failed to initialize — check
   that the device has Metal support (A7 chip or later).
3. **react-native-audio-api**: confirm `audioEngine.requestPermission()` shows
   the system permission dialog. After granting, `audioEngine.start()` should
   begin emitting `PitchSample` events. `audioEngine.tier` returns `1` when the
   native `AudioEngineModule` is linked, `2` when falling back to the worklet.

### 2g. Add the native audio module to the Xcode target (one-time, required for Tier 1)

Unlike Android (where the CMake + package registration are already wired in the
repo), the iOS Tier-1 native path needs a one-time Xcode project change that
cannot be scripted blind. In Xcode, with the `micdrp` target selected →
**Build Phases → Compile Sources**, add:

- `ios/AudioEngineModule.mm`
- every `cpp/dsp/*.cpp` (`mpm.cpp`, `notes.cpp`, `ring_buffer.cpp`,
  `pitch_engine.cpp`)

Then under **Build Settings → Header Search Paths**, add (recursive)
`$(SRCROOT)/../cpp/dsp`. Until this is done, `audioEngine.tier` resolves to `2`
(the audio-api worklet fallback) and the C++ core is not used on iOS. The
Android equivalent (`add_subdirectory(.../cpp …)` in `jni/CMakeLists.txt` and
`new AudioEnginePackage()` in `MainApplication.java`) is **already committed**.

---

## 3. Android Setup

### 3a. New Architecture flag (Android)

`packages/client/android/gradle.properties` contains:

```properties
newArchEnabled=false
```

Set `newArchEnabled=true` to enable the New Architecture (Fabric + TurboModules)
for Android. Rebuild after changing this.

### 3b. Microphone permission

`packages/client/android/app/src/main/AndroidManifest.xml` already declares:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

The runtime permission is requested at the `requestPermission()` call, which
triggers the system dialog on Android 6+.

### 3c. Run on an Android device

Enable USB debugging on the device, then:

```sh
# From repo root:
yarn workspace client android:development
# or: react-native run-android --mode debug

# Release build:
yarn workspace client android:production
```

The Gradle build compiles the C++ DSP core (`cpp/dsp/*.cpp`) into the native
module via the `CMakeLists.txt` additions in the Android app's build files.

### 3d. Verify react-native-audio-api, reanimated, and Skia on Android

Same checklist as iOS:

1. **reanimated**: pitch line animates at 60 fps without main-thread blocking.
2. **Skia**: canvas renders via the Vulkan/OpenGL ES backend.
3. **react-native-audio-api**: `audioEngine.tier` is `1` when the JNI
   `AudioEngineModule` is loaded.

---

## 4. Version-Pin Caveat: react-native-audio-api

`packages/client/package.json` pins `react-native-audio-api` at `^0.12.2`.
This library is under active development by Software Mansion and its API can
change across minor versions. Before confirming the pin:

1. Check the installed React Native version: `node -e "const {version} = require('react-native/package.json'); console.log(version)"`.
2. Check the `react-native-audio-api` changelog for the version actually
   resolved in `yarn.lock` to confirm the worklet API and `AudioWorkletNode`
   constructor are compatible with that RN version.
3. If a mismatch is found, update the pin in `packages/client/package.json`,
   run `yarn install`, and re-run `pod install` + Gradle sync.

The Tier-2 worklet (`src/audio/worklet/pitchProcessor.ts`) uses
`AudioWorkletNode` and assumes the Software Mansion API shape. If the library
version changes this interface, update `pitchProcessor.ts` accordingly.

---

## 5. C++ DSP Parity Test (optional, any machine with a C++17 compiler)

The Tier-1 C++ core (`cpp/dsp/`) ships a host-side parity test that validates
the C++ output against the TS oracle fixtures. This does **not** require iOS or
Android tooling:

```sh
cd packages/client/cpp/dsp

# With CMake:
cmake -S . -B build && cmake --build build
ctest --test-dir build --output-on-failure   # prints "PARITY OK", exit 0

# Without CMake:
c++ -std=c++17 -O2 -Wall -I. \
    mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
    __tests__/parity_test.cpp -o dsp_parity_test
./dsp_parity_test
```

See `cpp/dsp/README.md` for a full description of the parity assertions.

---

## 6. Verifying the JS Test Suite

Before touching hardware, confirm the pure-JS layer is green:

```sh
# All workspaces:
yarn test

# Client only:
yarn workspace client test

# With coverage:
yarn test --coverage
```

Jest mocks are configured in `packages/client/jest.setup.js` for:
reanimated, Skia, MMKV, react-native-fs, react-native-share,
and react-native-audio-api. Tests do not require a device.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `pod install` fails with "Unable to find a specification" | `node_modules` not present | `yarn install` first |
| Xcode build fails: "module 'React' not found" | opened `.xcodeproj` instead of `.xcworkspace` | `open ios/micdrp.xcworkspace` |
| `audioEngine.tier` returns `2` on device | native module not linked or build error | check Xcode build log; ensure `AudioEngineModule.mm` is in the Xcode target |
| Skia canvas is blank (iOS) | Metal not supported or entitlement missing | verify device A7+; check console for Skia init errors |
| reanimated logs "Shared value accessed on JS thread during render" | shared value read in render body | use `useAnimatedStyle` or `useDerivedValue` instead |
| Gradle sync fails: "CMake version X not found" | NDK CMake version mismatch | update `cmake` version in `android/app/build.gradle` to match installed NDK |
