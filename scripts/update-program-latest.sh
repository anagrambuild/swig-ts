#!/bin/bash
set -euo pipefail

BRANCH="${1:-main}"

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_DIR=$WORKSPACE_DIR/swig-program

if [ ! -d "$PROGRAM_DIR/.git" ]; then
  echo "⚠️ Could not find swig program .git dir. Cloning from source (branch: '$BRANCH')..." 
  rm -rf $PROGRAM_DIR
  
  # Use HTTPS with token if available (for CI), otherwise fall back to SSH
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git clone -q -b "$BRANCH" "https://${GITHUB_TOKEN}@github.com/anagrambuild/swig-wallet.git" $PROGRAM_DIR
  else
    git clone -q -b "$BRANCH" git@github.com:anagrambuild/swig-wallet.git $PROGRAM_DIR
  fi
else
  cd $PROGRAM_DIR
  echo "Pulling swig program latest from branch '$BRANCH'..."
  git fetch origin "$BRANCH" > /dev/null 2>&1
  git checkout "$BRANCH" > /dev/null 2>&1
  git pull origin "$BRANCH" -q
fi

PROGRAM_DEPLOY_DIR=$PROGRAM_DIR/target/deploy

cd $PROGRAM_DIR/program

echo "Program directory updated!"
echo "Building swig program..."
cargo build-sbf --arch v1 -- -q > /dev/null 2>&1

echo "Building test-program-authority..."
cargo build-sbf --arch v1 -p test-program-authority --features program_scope_test -- -q > /dev/null 2>&1

# Copy the main swig program
if [ -f $PROGRAM_DEPLOY_DIR/swig.so ]; then
    cp $PROGRAM_DEPLOY_DIR/swig.so $WORKSPACE_DIR
    echo "✅ Main program copied: $WORKSPACE_DIR/swig.so"
else
    echo "❌ Could not find swig.so"
    find target -name "*.so" -type f | head -5
    exit 1
fi

# Copy the test program authority (for ProgramExec testing)
if [ -f $PROGRAM_DEPLOY_DIR/test_program_authority.so ]; then
    cp $PROGRAM_DEPLOY_DIR/test_program_authority.so $WORKSPACE_DIR
    echo "✅ Test program copied: $WORKSPACE_DIR/test_program_authority.so"
else
    echo "⚠️ Could not find test_program_authority.so (optional for testing)"
fi

echo "✅ Program update complete!"