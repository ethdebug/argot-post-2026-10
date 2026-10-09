#!/bin/sh
# The arcade scenario's builds (bin/build-arcade.mjs), compiled offline
# and committed: Walnut's solc and vyper have no browser build, and the
# bugc builds are pinned too.
#   SOLC   a native solc from Walnut's fork, walnuthq/solidity PR #10
#          (head c434b2ea: 0.8.38-develop.2026.10.5+commit.c434b2ea)
#   VYPER  vyper 0.4.3
#   BUGC   packages/bugc of a built ethdebug/format checkout, at the
#          commit vendor/PIN names
# Usage: SOLC=… VYPER=… BUGC=… bin/build-arcade.sh
set -eu
: "${SOLC:?set SOLC to the solc of Walnut PR 10}"
: "${VYPER:?set VYPER to vyper 0.4.3}"
: "${BUGC:?set BUGC to a built packages/bugc}"
cd "$(dirname "$0")/.."
exec node bin/build-arcade.mjs
