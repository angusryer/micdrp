#!/bin/bash
set -e

# Run the `test` script (jest) in every workspace.
#
# `yarn workspace <name> test` is a built-in Yarn 3 command (no plugin
# needed), unlike the old Yarn 1 `yarn workspaces run test`.
# `--passWithNoTests` keeps packages that have no tests yet from failing the
# run, and any extra args (e.g. `--coverage` from CI) are forwarded to jest.
for pkg in logic models shared client; do
  yarn workspace "$pkg" test --passWithNoTests "$@"
done
