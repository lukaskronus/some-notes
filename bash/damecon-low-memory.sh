#!/bin/bash

DAMECON_BIN="./damecon-browser"

# Giới hạn heap tiến trình main (Electron 25 dùng V8 cũ, NODE_OPTIONS là cách duy nhất)
export NODE_OPTIONS="--max-old-space-size=512"

# Chỉ giới hạn renderer/worker qua js-flags (Electron 25 hiểu cờ này)
export ELECTRON_EXTRA_LAUNCH_ARGS="--js-flags=--max-old-space-size=512 \
--renderer-process-limit=2 \
--disable-gpu-compositing"

# Giới hạn cứng toàn bộ cây tiến trình
exec systemd-run --user --scope \
  -p MemoryMax=2G \
  -p MemoryHigh=1.5G \
  -p MemorySwapMax=512M \
  "${DAMECON_BIN}" "$@"
