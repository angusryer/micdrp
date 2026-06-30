#!/bin/bash
set -e

# Run the `test` script (jest) in each workspace.
#
# `yarn workspace <name> test` is a built-in Yarn 3 command (no plugin needed).
# It must be invoked through the root `yarn` (as `yarn test` does) so that
# jest — a root devDependency — is on PATH; Yarn 3 only exposes a workspace's
# own dependency binaries to its scripts.
#
# `--passWithNoTests` keeps packages with no tests from failing the run; extra
# args (e.g. `--coverage` from CI) are forwarded to jest. Override the package
# set with TEST_PACKAGES (CI runs only the Node-resolvable pure-TS packages,
# since the client RN suite needs the native deps installed — Phase V).
for pkg in ${TEST_PACKAGES:-logic models shared client}; do
  yarn workspace "$pkg" test --passWithNoTests "$@"
done
