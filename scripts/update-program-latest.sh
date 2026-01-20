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
echo "building swig program..."
cargo build-sbf --arch v1 -- -q > /dev/null 2>&1

# Find and copy the built program file (remove the duplicate cp command)
if [ -f $PROGRAM_DEPLOY_DIR/swig.so ]; then
    cp $PROGRAM_DEPLOY_DIR/swig.so $WORKSPACE_DIR
elif [ -f $PROGRAM_DEPLOY_DIR/*.so ]; then
    cp $PROGRAM_DEPLOY_DIR/*.so $WORKSPACE_DIR/swig.so
else
    echo "❌ Could not find built program file"
    find target -name "*.so" -type f | head -5
    exit 1
fi 

echo "✅ Program updated: $WORKSPACE_DIR/swig.so"