#!/bin/sh

# Configuration variables - Replace with your actual values
BOT_TOKEN="YOUR_BOT_TOKEN_HERE"          # Telegram Bot API token
CHAT_ID="YOUR_CHAT_ID_HERE"              # Telegram chat ID for notifications
TARGET_IP="YOUR_IP_ADDRESS"              # IP address of the target machine
TARGET_MAC="AA:BB:CC:DD:EE:FF"           # MAC address of the target machine (in uppercase, colon-separated)
INTERFACE="br-lan"                       # Network interface for sending magic packet (e.g., br-lan, eth0)

# Function to send a message via Telegram Bot API
send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
         -d chat_id="${CHAT_ID}" \
         -d text="${message}" \
         -d parse_mode="HTML" > /dev/null 2>&1
}

# Initial ping test with a single packet and 5-second timeout
if ! ping -c 1 -W 5 "${TARGET_IP}" > /dev/null 2>&1; then
    send_telegram "❌ The machine at <b>${TARGET_IP}</b> is down. Attempting to wake it up via magic packet."
    
    # Send magic packet using etherwake with specified interface
    etherwake -i "${INTERFACE}" -b "${TARGET_MAC}"
    sleep 60
    
    # Second ping test after delay
    if ping -c 1 -W 5 "${TARGET_IP}" > /dev/null 2>&1; then
        send_telegram "✅ The machine at <b>${TARGET_IP}</b> is now up and running."
    else
        send_telegram "⚠️ The machine at <b>${TARGET_IP}</b> failed to wake up. Manual intervention may be required."
    fi
fi
