#!/bin/bash
set -euo pipefail

BRANCH="${1:-main}"

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_DIR="$WORKSPACE_DIR/swig-program"
PROGRAM_DEPLOY_DIR="$PROGRAM_DIR/target/deploy"

build_sbf() {
  local build_dir="$1"
  local build_name="$2"
  shift 2
  local build_log
  build_log="$(mktemp)"

  echo "Building ${build_name}..."
  cd "$build_dir"

  if ! cargo build-sbf --arch v1 "$@" -- -q > "$build_log" 2>&1; then
    echo "❌ Failed to build ${build_name}"
    cat "$build_log"
    rm -f "$build_log"
    exit 1
  fi

  rm -f "$build_log"
}

if [ ! -d "$PROGRAM_DIR/.git" ]; then
  echo "⚠️ Could not find swig program .git dir. Cloning from source (branch: '$BRANCH')..."
  rm -rf "$PROGRAM_DIR"

  # Use HTTPS with token if available (for CI), otherwise fall back to SSH
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git clone -q -b "$BRANCH" "https://${GITHUB_TOKEN}@github.com/anagrambuild/swig-wallet.git" "$PROGRAM_DIR"
  else
    git clone -q -b "$BRANCH" git@github.com:anagrambuild/swig-wallet.git "$PROGRAM_DIR"
  fi
else
  cd "$PROGRAM_DIR"
  echo "Pulling swig program latest from branch '$BRANCH'..."
  git fetch origin "$BRANCH" > /dev/null 2>&1
  git checkout "$BRANCH" > /dev/null 2>&1
  git pull origin "$BRANCH" -q
fi

cd "$PROGRAM_DIR"

echo "Pinning blake3 to v1.8.2 for Solana build compatibility..."
cargo update -p blake3 --precise 1.8.2 > /dev/null 2>&1

echo "Program directory updated!"
build_sbf "$PROGRAM_DIR/program" "swig program"

if [ -f "$PROGRAM_DEPLOY_DIR/swig.so" ]; then
    cp "$PROGRAM_DEPLOY_DIR/swig.so" "$WORKSPACE_DIR"
    echo "✅ Main program copied: $WORKSPACE_DIR/swig.so"
else
    echo "❌ Could not find swig.so"
    find target -name "*.so" -type f | head -5
    exit 1
fi

# for ProgramExec testing
build_sbf "$PROGRAM_DIR/test-program-authority" "test-program-authority" --features program_scope_test

if [ -f "$PROGRAM_DEPLOY_DIR/test_program_authority.so" ]; then
    cp "$PROGRAM_DEPLOY_DIR/test_program_authority.so" "$WORKSPACE_DIR"
    echo "✅ Test authority program copied: $WORKSPACE_DIR/test_program_authority.so"
else
    echo "⚠️ Could not find test_program_authority.so"
fi

echo "✅ Program update complete!"
