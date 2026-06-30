# micdrp — Cleanliness Audit: results & deferred items

Audit of the completed codebase for cleanliness, deduplication, consolidation,
native-offload, and zero shims. Most findings were fixed in place; the items
below were deferred because they are larger refactors or need a real build to
verify, and are recorded so they aren't lost.

## Fixed in the audit
- **Dead code removed:** `utilities/hooks.ts` + `utilities/machine.ts` (unused
  after the auth rewrite); the legacy demo `AudioControlModule.java` +
  `AudioPackages.java` and their `MainApplication` registration (superseded by
  `AudioEngineModule`/`AudioEnginePackage`).
- **Data layer consolidated:** the superseded `recordings.ts` helpers pruned to
  just the cache index that `sync.ts`/`useLibrary` use — one store, no dual path.
- **Dedup (reverted):** an attempt to make `logic/notes.ts` import
  `NOTE_NAMES`/`NoteName` from `models` broke it (`export … from` creates no
  local binding, and it violated the module's deliberate dependency-free design
  for worklet/server portability). `notes.ts` keeps its local copy by design;
  `models` carries an identical domain copy. See "deferred" item 2.
- **Lint:** all error-level eslint issues fixed across `client` + `logic`; the
  jest run fixed (`babel.config.js` no longer loads the reanimated worklets
  plugin under test, where reanimated is fully mocked).
- **Comment accuracy:** `contract.ts` no longer claims to "mirror"
  `models.PitchSample` (they differ by design at the native boundary).
- **Verified clean:** heavy processing is native/off-JS-thread (C++ DSP +
  throttled `PitchSample`); **no shims/patches/`TODO`/`HACK`/`legacy`** remain;
  DTOs come from `shared`, not re-declared.

## Deferred (Phase V / larger refactors)

1. **iOS legacy demo module removal (human-only, Xcode).** Delete
   `ios/AudioControlModule.h` + `.m` and remove their 8 references from
   `ios/micdrp.xcodeproj/project.pbxproj` (2 `PBXBuildFile`, 2 `PBXFileReference`,
   2 group children, 2 `PBXSourcesBuildPhase`). Files were left on disk so the
   pbxproj references don't dangle until both are removed together (Xcode →
   Remove Reference → Move to Trash). The Android side is already removed.

2. **`models` package role.** `models` defines domain types (`NOTE_NAMES`,
   `NoteName`, `Note`, `PitchSample`, `Recording`, …) but the client reaches them
   through `contract`/`logic`, not directly; only `logic` imports `models`
   (`NOTE_NAMES`). Decide one of: (a) keep `models` as the domain base and have
   `logic`/`contract` derive from it explicitly, or (b) fold the genuinely-used
   bits (`NOTE_NAMES`/`NoteName`) into `logic` and the rest into `shared`, then
   delete `models`. Either is a package-graph change worth validating via CI.

3. **`IN_TUNE_TOLERANCE_CENTS` duplicate.** `shared/constants.ts` and
   `logic/scoring.ts` both encode the 50-cent default. Pick one owner once the
   `models`/`shared` boundary above is settled (kept separate for now to avoid a
   fragile cross-package coupling for a single constant).

4. **Stale prebuilt bundle.** `android/app/src/main/assets/index.android.bundle`
   is an old committed Metro bundle referencing the removed demo `App`. It is not
   imported by source and is regenerated on build; remove it (and gitignore the
   path) once a real build confirms nothing depends on the committed copy.

5. **midi→label inline math.** `Record/NoteRibbon` (needs a `'worklet'`-safe fn)
   and `Results/NoteList` both inline midi→name. Justified today; revisit if
   `logic` later exposes a worklet-safe label helper.
