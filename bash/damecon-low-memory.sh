#!/bin/bash

# Path to the Damecon executable (change if the name is different)
DAMECON_BIN="./damecon-browser"

# Memory limits
MAX_HEAP=1024                    # V8 heap limit in MB
MEMORY_MAX="2G"                  # Hard limit for the whole process tree
MEMORY_HIGH="1.5G"               # Soft limit

# Optional: lower GPU memory usage
export ELECTRON_EXTRA_LAUNCH_ARGS="--max-old-space-size=${MAX_HEAP} \
--js-flags=--max-old-space-size=${MAX_HEAP} \
--renderer-process-limit=3 \
--disable-gpu-compositing \
--disable-features=Vulkan"

# Launch with systemd memory protection (recommended)
exec systemd-run --user --scope \
  -p MemoryMax=${MEMORY_MAX} \
  -p MemoryHigh=${MEMORY_HIGH} \
  -p MemorySwapMax=1G \
  "${DAMECON_BIN}" "$@"
