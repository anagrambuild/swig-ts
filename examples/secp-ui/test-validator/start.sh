# !/bin/bash

set -euo pipefail

# Get the directory of the script, root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

solana-test-validator --reset \
  --bpf-program swigDk8JezhiAVde8k6NMwxpZfgGm2NNuMe1KYCmUjP ${SCRIPT_DIR}/../../../swig.so \
  --account 3LGufFdQr2CfRw6jUuVSQdvd1q7kQWuC9mBZUstmDNUM ${SCRIPT_DIR}/genesis/payer-state.json \

