#!/bin/bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

DAMECON_BIN="./damecon-browser"

# More V8 heap for heavy tabs (was 512M) -> less GC-thrash
export NODE_OPTIONS="--max-old-space-size=1024"

# Let Vega composite (was --disable-gpu-compositing); isolate heavy tab a bit (was 2)
ELECTRON_CHROMIUM_FLAGS="--js-flags=--max-old-space-size=1024 --renderer-process-limit=4 --disable-gpu-compositing"
export ELECTRON_EXTRA_LAUNCH_ARGS="${ELECTRON_CHROMIUM_FLAGS}"

# Headroom without eating whole system: throttle high, hard cap below total RAM, allow zram swap
exec systemd-run --user --scope \
  -p MemoryHigh=2600M \
  -p MemoryMax=3200M \
  -p MemorySwapMax=2G \
  "${DAMECON_BIN}" ${ELECTRON_CHROMIUM_FLAGS} "$@"
