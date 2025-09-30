#!/bin/bash
set -euo pipefail

# Enable debug mode to see each command being executed
set -x

BRANCH="${1:-main}"

echo "🔍 DEBUG: Starting script with branch: $BRANCH"

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_DIR=$WORKSPACE_DIR/swig-program

echo "🔍 DEBUG: WORKSPACE_DIR=$WORKSPACE_DIR"
echo "🔍 DEBUG: PROGRAM_DIR=$PROGRAM_DIR"

if [ ! -d "$PROGRAM_DIR/.git" ]; then
  echo "⚠️ Could not find swig program .git dir. Cloning from source (branch: '$BRANCH')..." 
  rm -rf $PROGRAM_DIR
  
  # Use HTTPS with token if available (for CI), otherwise fall back to SSH
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "🔍 DEBUG: Using GITHUB_TOKEN for authentication"
    echo "🔍 DEBUG: About to clone repository..."
    git clone -q -b "$BRANCH" "https://${GITHUB_TOKEN}@github.com/anagrambuild/swig-wallet.git" $PROGRAM_DIR
    echo "🔍 DEBUG: Clone completed successfully"
  else
    echo "🔍 DEBUG: Using SSH for authentication"
    git clone -q -b "$BRANCH" git@github.com:anagrambuild/swig-wallet.git $PROGRAM_DIR
    echo "🔍 DEBUG: Clone completed successfully"
  fi
else
  cd $PROGRAM_DIR
  echo "🔍 DEBUG: Directory exists, pulling latest changes..."
  echo "Pulling swig program latest from branch '$BRANCH'..."
  git fetch origin "$BRANCH" > /dev/null 2>&1
  git checkout "$BRANCH" > /dev/null 2>&1
  git pull origin "$BRANCH" -q
  echo "🔍 DEBUG: Pull completed successfully"
fi

echo "🔍 DEBUG: Changing to program directory: $PROGRAM_DIR"
cd $PROGRAM_DIR

echo "🔍 DEBUG: Current directory: $(pwd)"
echo "🔍 DEBUG: Directory contents:"
ls -la

echo "Program directory updated!"
echo "building swig program..."

echo "🔍 DEBUG: About to run cargo build-sbf..."
echo "🔍 DEBUG: Checking if cargo is available:"
which cargo || echo "❌ cargo not found"
cargo --version || echo "❌ cargo version failed"

echo "🔍 DEBUG: Running cargo build-sbf command..."
if cargo build-sbf --arch v1 -- -q > /dev/null 2>&1; then
    echo "🔍 DEBUG: Cargo build completed successfully"
else
    echo "❌ DEBUG: Cargo build failed with exit code: $?"
    echo "🔍 DEBUG: Trying cargo build without redirecting output to see errors:"
    cargo build-sbf --arch v1 -- -q
    exit 1
fi

echo "🔍 DEBUG: Checking target directory:"
ls -la target/ || echo "❌ target directory not found"
ls -la target/deploy/ || echo "❌ target/deploy directory not found"

echo "🔍 DEBUG: Looking for .so files:"
find target -name "*.so" -type f || echo "❌ No .so files found"

# Find and copy the built program file
if [ -f target/deploy/swig.so ]; then
    echo "🔍 DEBUG: Found target/deploy/swig.so, copying..."
    cp target/deploy/swig.so $WORKSPACE_DIR
    echo "🔍 DEBUG: Copy completed successfully"
elif [ -f target/deploy/*.so ]; then
    echo "🔍 DEBUG: Found .so file in target/deploy/, copying..."
    cp target/deploy/*.so $WORKSPACE_DIR/swig.so
    echo "🔍 DEBUG: Copy completed successfully"
else
    echo "❌ Could not find built program file"
    echo "🔍 DEBUG: Contents of target/deploy/:"
    ls -la target/deploy/ || echo "target/deploy/ directory doesn't exist"
    echo "🔍 DEBUG: All .so files in target:"
    find target -name "*.so" -type f | head -5
    exit 1
fi 

echo "🔍 DEBUG: Final check - does the output file exist?"
ls -la $WORKSPACE_DIR/swig.so || ls -la $WORKSPACE_DIR/*.so || echo "❌ Output file not found"

echo "✅ Program updated: $WORKSPACE_DIR/swig.so"
echo "🔍 DEBUG: Script completed successfully"