# micdrp monorepository

Micdrp is an app that brings your singing out of the shower and onto the stage using visual guidance and machine learning. 

## Motivation for this Project
I want have a meaningful and complex project to use as a showcase of my skills as a developer, and to have fun integrating the entire software lifecycle. Micdrp is also a passion project. The first version I made as the culminating activity of my web development diploma program at BrainStation. It was really simple, but it did the core task of measuring the pitch of your voice and displaying it as a line relative to a pitch that was being played back to you.

This version is a real, production-ready version of that project. I use Yarn workspaces. I use Linear to track bug, feature and story development, complete with Github integrations for public collaboration. The client uses React Native, written in TypeScript, Kotlin and Swift. The backend services are all written in TypeScript. I don't diligently practice test-driven development, but I tend to spend about 50% of my time writing tests before writing functional code and 50% of it writing functional code first. The app implements internationalization and uses Redis for local caching. Micdrp's deployment is fully automated via Github actions and custom scripts and is available on both the App Store and Google Play. The pipeline's progression depends on a sequence of passing tests, approved and successful PR merges, just as you might see in a production envrionment.

It's open source using licencing that allow me to sell the final product, yet permit it to be used elsewhere by anyone for any reason (hopefully not malicious).

Other notable things:
- Custom implementation of the auth flow, including custom native modules to support secure token storage
- Several audio-specific, hardware-optimized React Native modules were built to support fast audio processing and interaction between audio streams and React's work queuing and UI updating
- Modules developed for this app and its services are packaged and available on NPM 

## TODOs
[ ] Implement `git-secret` to store key stores and sensitive environment variables that are shared across the development team
[ ] Configure github actions to
    [ ] Install appropriate, version-controlled environment packages
    [ ] Run test suites
    [ ] Run build and deploy scripts, accessing git-secret environment variables
[ ] Install OWASP & licence checker, add to package.json
``` json
{
    "scripts": {
        "license": "license-checker --exclude 'MIT, MIT OR X11, BSD, ISC, Apache-2.0, Python-2.0, CC-BY-4.0' --excludePackages 'spdx-exceptions@2.3.0;spdx-license-ids@3.0.11'",
        "owasp": "dependency-check --project 'react-native' -s . --suppression ./owasp.suppression.xml"
    }
}
```

## Technologies used
- react native (bare, 0.86) for the client, with a C++ DSP core
- self-hosted PocketBase for the backend, on fly.io
- a Cloudflare Worker over D1 + R2 for over-the-air updates
- git-secret for environment variable storage and sharing

### Each of the below commands should be run from the root directory unless otherwise specified

## Setting up the development environment
- Ask to be added to the `git-secret` allowed list so you can access environment variables
-- You'll be given a public key from an admin
- Install the `rvest.vs-code-prettier-eslint` VS Code extension and set it up as per its own directions
- Clone this repository and change to the cloned directory
- Run `yarn`

## Running the app and server locally
You can run a complete development environment, including the client app on iOS, Android or both, as well as the server using development, staging or production environment variables with the command below:
`yarn dev -e [s|p|d] ios|android|both`

## Testing
You can run all test suites across all packages in the monorepo with this command:
`yarn test`

If you want to run tests for a specific package, then do this:
`yarn test client`
`yarn test server`
`yarn test models`
`yarn test logic`

You can specify specific tests within each package, or across all workspaces by providing a basic regex, such as:
`yarn test /*some test description fragment*/`, or
`yarn test client /*some test description fragment*/`

## Building and/or Deploying
```sh
yarn release:check          # can I ship right now?
yarn preflight              # the gate: specs, types, lint, tests
yarn release 1.0.0          # gate, build, upload to TestFlight
```

`scripts/release.sh` is the only entry point. The build number is derived from
what TestFlight already has rather than typed, so nothing needs to remember to
bump it. See the `micdrp-ship` skill for signing, credentials and the
troubleshooting that matters.

### Legacy commands below are out of date

The `yarn dev` / `yarn build --deploy` invocations described further down predate
the current release scripts, as do the references to an express server and
React Native 0.72. Treat the block above and `micdrp-ship` as authoritative.

You can build and deploy to both the App Store and Google Play with this command:
`yarn build --deploy --e [s|p] [ios|android|both]`

This is will detect the current version of the app, increment it appropriately, and verify the app packages for you before deployment. By default the build number is incremented in all environments, and the maintenance number (0.0.X) is incremented for staging and production builds. If you would like to increment the minor (0.X.0) or major version numbers (X.0.0), you can. The command below will build, _not_ deploy, and bump up the minor version by 1.
`yarn build -me [s|p|d] [ios|android|both]`

This will raise the major version number by one:
`yarn build -Me [s|p|d] [ios|android|both]`

### Note that _only the build number will increment when specifying the `d` (developement) environment


---

## Over-the-air updates

A JavaScript-only fix can reach an installed TestFlight build without another
archive, upload and review cycle.

```sh
yarn ota publish beta                 # version and min-build from .env.production
yarn ota publish beta --min-build 7   # needs a native change that shipped in build 7
yarn ota publish beta --dry-run       # everything up to the upload
yarn ota list beta                    # what is published, newest first
yarn ota disable <bundleId>           # withdraw; installs roll back on next check
yarn ota whoami                       # which Cloudflare account is in scope
```

**`--min-build` is the one that matters.** It defaults to the current
`BUILD_NUMBER`, which is right for a pure JavaScript fix. Raise it whenever the
bundle calls something that only exists in a newer binary: JavaScript reaching
for a native module the binary lacks crashes rather than degrading.

Four rules govern the whole thing, and each is a failure mode avoided:

- **TestFlight only.** Eligibility is read at runtime from the App Store
  receipt (`sandboxReceipt` means TestFlight), never from a build-time flag —
  the binary promoted to the App Store is the same one TestFlight ran, so
  nothing baked in can tell them apart. An App Store install makes no request
  at all.
- **Never to a binary that cannot run it.** A bundle declares the app version
  and lowest build number it may run on, and the server refuses everything else.
- **Never over singing.** The singer is asked before any reload, and the prompt
  is suppressed entirely while a capture or practice session is running — a
  modal over a live take costs the take.
- **A bundle that will not boot is replaced on its own**, before JavaScript
  runs. That is the case that has to work when the thing that would deliver the
  fix is itself broken.

Only JavaScript ships this way. The C++ pitch engine, every native module, and
every value `react-native-config` compiled into the binary need a real build.

iOS only for now: the receipt check has no Android equivalent, so the server
refuses to serve it rather than serving bundles it could not gate.

Details, credentials and provisioning: [backend/ota/README.md](backend/ota/README.md).
Specification: `.harnex/project/specs/domains/updates/`.

---

## Native App (React Native 0.86 + New Architecture)

The `packages/client` package is a bare React Native app (not Expo) with a
shared C++ DSP core for real-time pitch detection. Key documentation:

| Document | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data-flow diagram (mic → C++ MPM → JSI → Reanimated/Skia), package map, three-tier DSP model, offline pipeline reuse from `packages/logic` |
| [docs/NATIVE_SETUP.md](docs/NATIVE_SETUP.md) | Phase V runbook: Node/Yarn via Corepack, `yarn install`, `bundle install && pod install`, New Architecture flags (`RCT_NEW_ARCH_ENABLED` / `newArchEnabled`), microphone permissions, running on device (iOS + Android), verifying react-native-audio-api + reanimated + Skia |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Signing setup (Match for iOS, keystore for Android), the full ENV/secrets matrix consumed by fastlane and the release workflows, TestFlight and Play internal-track steps, release runbook, rollback procedures, how to enable the `workflow_dispatch` release workflows |
| [docs/NATIVE_BUILD_PLAN.md](docs/NATIVE_BUILD_PLAN.md) | Authoritative spec: architecture decisions, work-package breakdown (WP-FOUNDATION through WP-SYNTH), invariants for all agents |
