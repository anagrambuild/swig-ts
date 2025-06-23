#!/bin/bash
set -euo pipefail

BRANCH="${1:-main}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRAM_DIR=$SCRIPT_DIR/swig-program

if [ ! -d "$PROGRAM_DIR/.git" ]; then
  echo "⚠️ Could not find swig program .git dir. Cloning from source (branch: '$BRANCH')..." 
  rm -rf $PROGRAM_DIR
  git clone -q -b "$BRANCH" git@github.com:anagrambuild/swig-wallet.git $PROGRAM_DIR
else
  cd $PROGRAM_DIR
  echo "Pulling swig program latest from branch '$BRANCH'..."
  git fetch origin "$BRANCH" > /dev/null 2>&1
  git checkout "$BRANCH" > /dev/null 2>&1
  git pull origin "$BRANCH" -q
fi

cd $PROGRAM_DIR

echo "Program directory updated!"
echo "building swig program..."
cargo build-sbf -- -q > /dev/null 2>&1
cp target/deploy/swig.so $SCRIPT_DIR 

echo "✅ Program updated: $SCRIPT_DIR/swig.so"