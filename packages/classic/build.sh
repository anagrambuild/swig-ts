#!/bin/bash

set -euo pipefail

# Get the directory of the script, root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# go home
cd ../..

# build dependencies
bun run --filter='@swig-wallet/coder' build 

# return to root directory
cd ${SCRIPT_DIR}

# build package
bun run build-pkg
