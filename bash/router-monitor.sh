#!/bin/sh
# OpenWRT Router Monitor + Telegram Alerts
# Compatible with ash/busybox.

# ========== CONFIG ==========
BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
CHAT_ID="YOUR_CHAT_ID_HERE"
STATE_DIR="/etc/router-monitor"          # persistent storage
CHECK_INTERVAL=60                        # seconds between full checks (used by cron or loop)
CPU_WARN=80                              # % CPU load average (1-min) warning threshold
TEMP_WARN=75                             # °C warning threshold (adjust for your SoC)
MEM_WARN=85                              # % memory used warning
DISK_WARN=90                             # % root used warning
STATUS_INTERVAL=3600                     # send a status summary every N seconds (0 = disable)
PING_TARGET="8.8.8.8"                    # for internet check
# ============================

mkdir -p "$STATE_DIR"
CLIENTS_FILE="$STATE_DIR/seen_clients"
LAST_STATUS="$STATE_DIR/last_status"
mkdir -p "$(dirname "$CLIENTS_FILE")"
touch "$CLIENTS_FILE"

# --- helpers ---
tg() {
    # $1 = message text
    [ -z "$BOT_TOKEN" ] || [ "$BOT_TOKEN" = "YOUR_BOT_TOKEN_HERE" ] && return
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${CHAT_ID}" \
        --data-urlencode "text=$1" \
        --data-urlencode "disable_web_page_preview=true" >/dev/null
}

get_temp() {
    # Try common thermal zones; return first valid reading in °C
    for z in /sys/class/thermal/thermal_zone*/temp; do
        [ -r "$z" ] || continue
        t=$(cat "$z" 2>/dev/null)
        [ -n "$t" ] && [ "$t" -gt 0 ] 2>/dev/null && echo $((t / 1000)) && return
    done
    # Fallback for some MediaTek / Qualcomm boards
    for f in /sys/devices/virtual/thermal/thermal_zone*/temp \
             /sys/class/hwmon/hwmon*/temp1_input; do
        [ -r "$f" ] || continue
        t=$(cat "$f" 2>/dev/null)
        [ -n "$t" ] && [ "$t" -gt 0 ] 2>/dev/null && echo $((t / 1000)) && return
    done
    echo "n/a"
}

get_cpu_load() {
    # 1-minute load average
    awk '{print $1}' /proc/loadavg
}

get_mem_pct() {
    # Used memory %
    free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}'
}

get_disk_pct() {
    df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}'
}

get_uptime() {
    awk '{printf "%dd %dh %dm", $1/86400, ($1%86400)/3600, ($1%3600)/60}' /proc/uptime
}

internet_ok() {
    ping -c 1 -W 2 "$PING_TARGET" >/dev/null 2>&1
}

# Collect currently connected clients (wireless + wired)
# Output format: MAC|IP|HOSTNAME|IFACE
collect_clients() {
    # Wireless stations (all wifi interfaces)
    for iface in $(iw dev 2>/dev/null | awk '/Interface/ {print $2}'); do
        iw dev "$iface" station dump 2>/dev/null | awk -v ifc="$iface" '
            /^Station/ { mac=$2 }
            /signal:/  { sig=$2 }
            /authenticated:/ { auth=$2 }
            /authorized:/ { authz=$2 }
            /TDLS peer:/ { next }
            {
                if (mac != "") {
                    # We only care about associated stations
                    print mac "|?|?|" ifc
                    mac=""
                }
            }'
    done

    # Also try ubus hostapd (more reliable on some builds)
    for path in /var/run/hostapd/*.conf; do
        [ -e "$path" ] || continue
        iface=$(basename "$path" .conf)
        hostapd_cli -i "$iface" -p /var/run/hostapd all_sta 2>/dev/null | \
            awk -v ifc="$iface" '/^[0-9a-f:]{17}$/ {print $1 "|?|?|" ifc}'
    done

    # Wired clients via bridge MAC table + ARP
    # Prefer bridge if present
    if command -v brctl >/dev/null 2>&1; then
        brctl showmacs br-lan 2>/dev/null | awk 'NR>1 && $3=="no" {print $2 "|?|?|br-lan"}'
    fi

    # ARP / neighbor table (covers both wired and wireless that have IP)
    ip -4 neigh show 2>/dev/null | awk '
        $1 ~ /^[0-9.]+$/ && $3 ~ /^[0-9a-f:]{17}$/ && $NF ~ /REACHABLE|STALE|DELAY|PROBE/ {
            print $3 "|" $1 "|?|" $5
        }'

    # Fallback: pure ARP
    cat /proc/net/arp 2>/dev/null | awk 'NR>1 && $4 != "00:00:00:00:00:00" {
        print $4 "|" $1 "|?|lan"
    }'
}

# Enrich with hostname from DHCP leases if possible
enrich_hostname() {
    mac="$1"
    ip="$2"
    # dnsmasq leases
    if [ -r /tmp/dhcp.leases ]; then
        awk -v m="$mac" -v i="$ip" '
            tolower($2)==tolower(m) || $3==i {print $4; exit}
        ' /tmp/dhcp.leases
    fi
}

# --- main monitoring logic ---
run_check() {
    now=$(date +%s)
    hostname=$(cat /proc/sys/kernel/hostname 2>/dev/null || echo "router")

    # ---- New clients ----
    collect_clients | sort -u | while IFS='|' read -r mac ip host iface; do
        [ -z "$mac" ] && continue
        # Normalize MAC to lowercase
        mac=$(echo "$mac" | tr 'A-F' 'a-f')

        # Skip if already seen
        grep -qi "^$mac" "$CLIENTS_FILE" 2>/dev/null && continue

        # Try to get better IP / hostname
        real_ip="$ip"
        real_host=$(enrich_hostname "$mac" "$ip")
        [ -z "$real_host" ] || [ "$real_host" = "?" ] && real_host="unknown"
        [ "$real_ip" = "?" ] && real_ip=$(ip -4 neigh show | awk -v m="$mac" 'tolower($3)==m {print $1; exit}')

        # Record it
        echo "$mac $real_ip $real_host $iface $(date '+%Y-%m-%d %H:%M')" >> "$CLIENTS_FILE"

        msg="🆕 New client on $hostname
MAC: $mac
IP: ${real_ip:-?}
Host: $real_host
Iface: $iface
Time: $(date '+%Y-%m-%d %H:%M:%S')"
        tg "$msg"
    done

    # ---- Resource checks ----
    load=$(get_cpu_load)
    temp=$(get_temp)
    mem=$(get_mem_pct)
    disk=$(get_disk_pct)
    up=$(get_uptime)

    # CPU load warning (1-min load)
    load_int=${load%.*}
    if [ -n "$load_int" ] && [ "$load_int" -ge "$CPU_WARN" ] 2>/dev/null; then
        tg "⚠️ High CPU load on $hostname
1-min load: $load (threshold $CPU_WARN)
Uptime: $up"
    fi

    # Temperature warning
    if [ "$temp" != "n/a" ] && [ "$temp" -ge "$TEMP_WARN" ] 2>/dev/null; then
        tg "🔥 High temperature on $hostname
Temp: ${temp}°C (threshold ${TEMP_WARN}°C)
Uptime: $up"
    fi

    # Memory warning
    if [ -n "$mem" ] && [ "$mem" -ge "$MEM_WARN" ] 2>/dev/null; then
        tg "💾 High memory usage on $hostname
Used: ${mem}% (threshold ${MEM_WARN}%)
Uptime: $up"
    fi

    # Disk warning
    if [ -n "$disk" ] && [ "$disk" -ge "$DISK_WARN" ] 2>/dev/null; then
        tg "📦 High disk usage on $hostname
Root used: ${disk}% (threshold ${DISK_WARN}%)"
    fi

    # Internet connectivity
    if ! internet_ok; then
        tg "🌐 Internet check FAILED on $hostname
Cannot reach $PING_TARGET
Time: $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    # ---- Periodic status summary ----
    if [ "$STATUS_INTERVAL" -gt 0 ]; then
        last=0
        [ -f "$LAST_STATUS" ] && last=$(cat "$LAST_STATUS")
        if [ $((now - last)) -ge "$STATUS_INTERVAL" ]; then
            echo "$now" > "$LAST_STATUS"
            clients=$(wc -l < "$CLIENTS_FILE" 2>/dev/null || echo 0)
            net_status="OK"
            internet_ok || net_status="FAIL"

            tg "📊 Status — $hostname
Uptime: $up
Load: $load
Temp: ${temp}°C
Mem: ${mem}%
Disk: ${disk}%
Seen clients: $clients
Internet: $net_status
$(date '+%Y-%m-%d %H:%M:%S')"
        fi
    fi
}

# If called with "loop" argument → run forever (for testing)
if [ "$1" = "loop" ]; then
    while true; do
        run_check
        sleep "$CHECK_INTERVAL"
    done
else
    run_check
fi
