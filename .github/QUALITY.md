# Quality Gates

This document describes the automated quality gates for micdrp.

## CI Pipeline (`.github/workflows/ci.yml`)

Automatic runs are triggered on every push and pull request targeting `main`
or any `claude/**` branch.

| Job | Command | Purpose |
|-----|---------|---------|
| `lint` | `yarn lint` | ESLint across all packages (`packages/`) |
| `test` | `yarn test --maxWorkers=2 --coverage` | Jest unit tests with coverage report |
| `typecheck` | `yarn typecheck` | Full monorepo TypeScript compilation check (`tsc --noEmit`) |

All three jobs use the shared `.github/actions/setup` composite action which:
- Reads the Node version from `.nvmrc`
- Enables Corepack (so the `packageManager` field in `package.json` is honoured)
- Restores the Yarn cache keyed on `yarn.lock`
- Runs `yarn install --immutable` on cache miss

The mobile binary build (iOS/Android) requires macOS + Xcode/Gradle and is a
deployment-op concern; it is not part of the PR check suite.

Release workflows (`release-ios.yml`, `release-android.yml`) remain
**manual** (`workflow_dispatch` only) and are not affected by these gates.

## License audit (`yarn license`)

```
yarn license
```

Runs [`license-checker`](https://github.com/davglass/license-checker) across
production dependencies and prints a summary of every SPDX license identifier
in use. This is an informational command; it does not fail the build. Run it
before shipping a release to catch any newly introduced copyleft or
proprietary licenses.

## OWASP dependency vulnerability check (`yarn owasp`)

```
yarn owasp
```

Runs the [OWASP Dependency-Check CLI](https://jeremylong.github.io/DependencyCheck/)
over the whole monorepo and fails (exit 1) on any CVE with a CVSS score >= 7
(high severity). The command ends with `|| true` so that CI reporters can
collect the HTML/XML report even when the threshold is breached — treat a
non-zero exit as a blocking signal during a manual release review, not a
silent pass.

Known-false-positive or accepted-risk suppressions are documented in
[`owasp.suppression.xml`](../owasp.suppression.xml) at the repo root. Every
suppression entry must include a `<notes>` element explaining the rationale.

## Running locally

```bash
# Lint
yarn lint

# Tests with coverage
yarn test --coverage

# TypeScript type check
yarn typecheck

# License summary
yarn license

# OWASP vulnerability scan (requires dependency-check on PATH)
yarn owasp
```
