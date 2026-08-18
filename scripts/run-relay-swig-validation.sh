#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Relay + Swig End-to-End Validation
#
# Starts surfpool, runs the USDC cheatcode validation, prints explorer links,
# and leaves surfpool running so you can inspect transactions.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SURFPOOL_HOST="${SURFPOOL_HOST:-127.0.0.1}"
SURFPOOL_PORT="${SURFPOOL_PORT:-18999}"
SURFPOOL_WS_PORT="${SURFPOOL_WS_PORT:-$((SURFPOOL_PORT + 1))}"
SURFPOOL_RPC="http://${SURFPOOL_HOST}:${SURFPOOL_PORT}"
SURFPOOL_PID=""
SURFPOOL_LOG="${REPO_DIR}/surfpool.log"

# Explorer base URL - uses Solana Explorer with custom RPC
EXPLORER_BASE="https://explorer.solana.com/tx"

cleanup() {
  if [[ -n "$SURFPOOL_PID" ]] && kill -0 "$SURFPOOL_PID" 2>/dev/null; then
    echo ""
    echo "=========================================="
    echo "Surfpool is still running (PID $SURFPOOL_PID)"
    echo "RPC: $SURFPOOL_RPC"
    echo "WS:  ws://${SURFPOOL_HOST}:${SURFPOOL_WS_PORT}"
    echo "Log: $SURFPOOL_LOG"
    echo ""
    echo "To stop it:  kill $SURFPOOL_PID"
    echo "=========================================="
  fi
}
trap cleanup EXIT

echo "=== Relay + Swig E2E Validation ==="
echo ""

# ---- 1. Check prerequisites ----
echo "[1/4] Checking prerequisites..."

if ! command -v surfpool &>/dev/null; then
  echo "ERROR: surfpool not found in PATH. Install it first."
  exit 1
fi

if ! command -v bun &>/dev/null; then
  echo "ERROR: bun not found in PATH. Install it first."
  exit 1
fi

if [[ ! -f "$REPO_DIR/scripts/relay-usdc-cheatcode-validation.ts" ]]; then
  echo "ERROR: Validation script not found at scripts/relay-usdc-cheatcode-validation.ts"
  exit 1
fi

echo "  surfpool: $(which surfpool)"
echo "  bun:      $(which bun)"
echo ""

# ---- 2. Start surfpool ----
echo "[2/4] Starting surfpool on $SURFPOOL_RPC ..."

# Kill any existing process on the selected ports
if lsof -ti:"$SURFPOOL_PORT" &>/dev/null; then
  echo "  Port $SURFPOOL_PORT already in use. Killing existing process..."
  lsof -ti:"$SURFPOOL_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

if lsof -ti:"$SURFPOOL_WS_PORT" &>/dev/null; then
  echo "  WS port $SURFPOOL_WS_PORT already in use. Killing existing process..."
  lsof -ti:"$SURFPOOL_WS_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

surfpool start \
  --port "$SURFPOOL_PORT" \
  --ws-port "$SURFPOOL_WS_PORT" \
  --host "$SURFPOOL_HOST" \
  --network mainnet \
  --no-tui \
  --no-deploy \
  --yes \
  --log-level warn \
  --daemon \
  > "$SURFPOOL_LOG" 2>&1 || true

# Wait for surfpool to be ready
echo "  Waiting for surfpool RPC to respond..."
MAX_WAIT=30
WAITED=0
while ! curl -s "$SURFPOOL_RPC" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  2>/dev/null | grep -q "result\|ok" 2>/dev/null; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    echo "  ERROR: surfpool did not start within ${MAX_WAIT}s"
    echo "  Check log: $SURFPOOL_LOG"
    cat "$SURFPOOL_LOG" 2>/dev/null | tail -20
    exit 1
  fi
done

# Find the surfpool PID
SURFPOOL_PID=$(lsof -ti:"$SURFPOOL_PORT" 2>/dev/null | head -1 || true)
echo "  Surfpool ready (PID: ${SURFPOOL_PID:-unknown})"
echo ""

# ---- 3. Run validation ----
echo "[3/4] Running Relay + Swig USDC cheatcode validation..."
echo "      (this fetches a live Relay quote, funds with cheatcodes, and executes)"
echo ""

# Run the validation and capture output
cd "$REPO_DIR"
VALIDATION_OUTPUT=$(SURFPOOL_RPC="$SURFPOOL_RPC" bun scripts/relay-usdc-cheatcode-validation.ts 2>&1) || {
  echo "ERROR: Validation script failed!"
  echo ""
  echo "$VALIDATION_OUTPUT"
  exit 1
}

echo "$VALIDATION_OUTPUT"
echo ""

# ---- 4. Extract signatures and print explorer links ----
echo "[4/4] Transaction Explorer Links"
echo "=========================================="
echo ""
echo "Use these links to inspect transactions in Solana Explorer"
echo "with surfpool as the custom RPC endpoint."
echo ""

# Extract signatures from output
BASELINE_SIGS=$(echo "$VALIDATION_OUTPUT" | grep "baseline signatures:" | sed 's/.*baseline signatures: //')
SWIG_SIGS=$(echo "$VALIDATION_OUTPUT" | grep "swig signatures:" | sed 's/.*swig signatures: *//')

# URL-encode the RPC for the explorer custom param
ENCODED_RPC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SURFPOOL_RPC', safe=''))" 2>/dev/null || echo "$SURFPOOL_RPC")

print_explorer_links() {
  local label="$1"
  local sigs="$2"

  # Split by comma
  IFS=',' read -ra SIG_ARRAY <<< "$sigs"
  for sig in "${SIG_ARRAY[@]}"; do
    sig=$(echo "$sig" | xargs)  # trim whitespace
    if [[ -n "$sig" ]]; then
      echo "  $label:"
      echo "    Signature: $sig"
      echo "    Explorer:  ${EXPLORER_BASE}/${sig}?cluster=custom&customUrl=${ENCODED_RPC}"
      echo ""
    fi
  done
}

print_explorer_links "Baseline (quote user)" "$BASELINE_SIGS"
print_explorer_links "Swig-wrapped (mutated)" "$SWIG_SIGS"

echo "=========================================="
