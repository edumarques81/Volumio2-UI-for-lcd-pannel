#!/bin/bash
set -euo pipefail

# stellar-viz WASM build script
# Builds the Rust crate to WebAssembly for web integration.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 Building stellar-viz WASM module..."

# Run tests first
echo "🧪 Running tests..."
cargo test --quiet

# Run clippy
echo "🔍 Running clippy..."
cargo clippy -- -D warnings

# Build WASM
echo "📦 Building WASM (--target web)..."
wasm-pack build --target web --release

echo ""
echo "✅ Build complete!"
echo "   Output: $SCRIPT_DIR/pkg/"
ls -la pkg/*.wasm pkg/*.js 2>/dev/null || echo "   (check pkg/ directory)"
