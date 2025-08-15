#!/bin/bash

# Script to run all TypeScript examples under examples/ directory
# Usage: ./run-examples.sh

set -e

echo "Running all TypeScript examples..."
echo "=================================="

# Find all .ts files in examples/classic and examples/kit directories and run them with bun
find examples/classic examples/kit -name "*.ts" -type f | sort | while read -r file; do
    echo ""
    echo "Running: $file"
    echo "----------------------------------------"
    
    if bun run "$file"; then
        echo "✅ Success: $file"
    else
        echo "❌ Failed: $file"
        exit 1
    fi
done

echo ""
echo "All examples completed successfully!"