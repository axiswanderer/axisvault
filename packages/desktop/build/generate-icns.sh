#!/bin/bash
# Generates build/icon.icns from icon-512.png. Run this on macOS — iconutil
# is an Apple-only tool and isn't available on Linux/Windows, so this step
# can't be done in CI unless the CI runner is macOS (e.g. GitHub Actions'
# macos-latest runner).
set -e
cd "$(dirname "$0")"

if ! command -v iconutil &> /dev/null; then
  echo "iconutil not found — this script must be run on macOS."
  exit 1
fi

ICONSET=icon.iconset
mkdir -p "$ICONSET"

sips -z 16 16   icon-512.png --out "$ICONSET/icon_16x16.png"
sips -z 32 32   icon-512.png --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32   icon-512.png --out "$ICONSET/icon_32x32.png"
sips -z 64 64   icon-512.png --out "$ICONSET/icon_32x32@2x.png"
sips -z 128 128 icon-512.png --out "$ICONSET/icon_128x128.png"
sips -z 256 256 icon-512.png --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256 icon-512.png --out "$ICONSET/icon_256x256.png"
sips -z 512 512 icon-512.png --out "$ICONSET/icon_256x256@2x.png"
cp icon-512.png "$ICONSET/icon_512x512.png"

iconutil -c icns "$ICONSET" -o icon.icns
rm -rf "$ICONSET"

echo "Generated icon.icns"
