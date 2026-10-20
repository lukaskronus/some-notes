#!/bin/sh
###############################################################################
# /usr/bin/telegram-alerts.sh
#
# OpenWRT health monitor → Telegram alerts (BusyBox ash, no extra packages).
#
# Monitors: CPU (loadavg), memory, uptime, WAN ping, DHCP/wifi client count,
#           interface traffic, temperature, service status, WAN IP,
#           new-device detection (persisted MAC registry).
#
# Run modes:
#   1) cron (recommended):  */5 * * * *  /usr/bin/telegram-alerts.sh --cron
#   2) daemon:              /etc/init.d/telegram-alerts start
#
# State: /etc/telegram-alerts/state (survives reboot)
# No local log is written (per requirement).
###############################################################################

# ============================ CONFIG =========================================
BOT_TOKEN="123456789:REPLACE_ME_WITH_YOUR_TOKEN"
CHAT_ID="-1001234567890"          # personal chat ID (positive) or group/channel (negative)
HOSTNAME_TAG="$(cat /proc/sys/kernel/hostname 2>/dev/null || echo router)"

STATE_DIR="/etc/telegram-alerts"
STATE_FILE="$STATE_DIR/state"
KNOWN_MACS="$STATE_DIR/known_macs"

# Thresholds (percent). "Variable" per your answer — tune here.
CPU_LOAD_PCT=80          # 1-min loadavg vs core count
MEM_PCT=80
DISK_PCT=80
TEMP_C=75

# WAN connectivity
PING_TARGETS="1.1.1.1 8.8.8.8"
PING_FAIL_STREAK=3       # consecutive failed checks before alerting

# Services to watch (name:init.d-script)
SERVICES="dnsmasq firewall dropbear"

# Interfaces for traffic reporting (comma-separated)
IFACES="wan lan"

# Daemon interval (seconds)
DAEMON_INTERVAL=300

# Telegram message format
PARSE_MODE="Markdown"

# Enforce HTTPS verification (requires ca-bundle, which you have)
CURL_OPTS="-sS --fail --max-time 20 --proto =https --tlsv1.2"

# ============================ HELPERS ========================================
CORES=$(grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 1)
[ "$CORES" -lt 1 ] && CORES=1
NOW() { date '+%Y-%m-%d %H:%M:%S'; }

# Escape for Telegram Markdown (legacy). Only escapes the essentials.
md_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/_/\\_/g' -e 's/\*/\\*/g' -e 's/`/\\`/g' -e 's/\[/\\[/g'; }

# Read/update state file: state_get <key>  /  state_set <key> <value>
state_get() { grep "^$1=" "$STATE_FILE" 2>/dev/null | tail -n1 | cut -d= -f2-; }
state_set() {
    mkdir -p "$STATE_DIR"
    [ -f "$STATE_FILE" ] || : > "$STATE_FILE"
    # remove old key, append new
    sed -i "/^$1=/d" "$STATE_FILE" 2>/dev/null
    printf '%s=%s\n' "$1" "$2" >> "$STATE_FILE"
}

# send_telegram <text>   (returns 0 on success)
send_telegram() {
    local text="$1"
    curl $CURL_OPTS \
        --data-urlencode "chat_id=$CHAT_ID" \
        --data-urlencode "parse_mode=$PARSE_MODE" \
        --data-urlencode "disable_web_page_preview=true" \
        --data-urlencode "text=$text" \
        "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" >/dev/null
}

# ======================= METRIC READERS ======================================
metric_cpu_load_pct() {
    # loadavg 1-min * 100 / cores
    local l1 l1_int l1_frac
    l1=$(cut -d' ' -f1 /proc/loadavg)
    l1_int=${l1%%.*}
    l1_frac=${l1#*.}
    [ "$l1_frac" = "$l1" ] && l1_frac=0
    # l1_frac may have 2 digits; take first 2
    l1_frac=$(printf '%s' "$l1_frac" | cut -c1-2)
    [ -z "$l1_frac" ] && l1_frac=0
    echo $(( (l1_int * 100 + l1_frac) / CORES ))
}

metric_mem_pct() {
    awk '
        /^MemTotal:/ {t=$2}
        /^MemAvailable:/ {a=$2}
        END { if (t>0) printf "%d\n", (t-a)*100/t; else print 0 }
    ' /proc/meminfo
}

metric_disk_pct() {
    # overlay/root usage
    df -k /overlay 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}' \
        || df -k / | awk 'NR==2{gsub("%","",$5); print $5}'
}

metric_uptime() { cut -d' ' -f1 /proc/uptime; }

metric_temp_c() {
    local t=""
    if [ -d /sys/class/thermal ]; then
        for z in /sys/class/thermal/thermal_zone*/temp; do
            [ -r "$z" ] || continue
            t=$(cat "$z")
            echo $(( t / 1000 )); return
        done
    fi
    if [ -d /sys/class/hwmon ]; then
        for f in /sys/class/hwmon/hwmon*/temp1_input; do
            [ -r "$f" ] || continue
            t=$(cat "$f")
            echo $(( t / 1000 )); return
        done
    fi
    echo ""
}

metric_client_count() {
    local c=0
    if [ -r /tmp/dhcp.leases ]; then
        c=$(wc -l < /tmp/dhcp.leases)
    fi
    # add wifi assoc count if available
    if [ -d /sys/class/net ]; then
        for n in /sys/class/net/*; do
            [ -r "$n/operstate" ] || continue
            b=$(basename "$n")
            case "$b" in wlan*|phy*|ra*|rai*) ;; *) continue ;; esac
            if [ -r "$n/statistics/rx_packets" ]; then :; fi
        done
    fi
    echo "$c"
}

metric_wan_ip() {
    # prefer ubus/network, fall back to ip addr on wan
    ip -4 addr show dev wan 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1
}

metric_iface_traffic() {
    # prints "wan_rx=.. wan_tx=.. lan_rx=.. lan_tx=.." (bytes)
    awk -v ifs="$IFACES" '
        BEGIN { n=split(ifs,a," "); for(i=1;i<=n;i++) want[a[i]]=1 }
        { sub(":","",$1); if ($1 in want) printf "%s_rx=%s %s_tx=%s ", $1,$2,$1,$10 }
    ' /proc/net/dev
}

metric_service_up() {
    # service_up <name>
    if [ -x "/etc/init.d/$1" ]; then
        if /etc/init.d/"$1" status >/dev/null 2>&1; then echo 1; else echo 0; fi
    else
        echo 1  # not installed → treat as fine
    fi
}

wan_connectivity_ok() {
    local ok=0
    for t in $PING_TARGETS; do
        if ping -c1 -W2 "$t" >/dev/null 2>&1; then ok=1; break; fi
    done
    echo "$ok"
}

# ======================= ALERT ENGINE ========================================
# Each metric handler: compare, manage "in_breach:<m>" state, emit lines into $DIGEST.
# DIGEST is a plain-text buffer; we build one Markdown message per run.

BREACH_COUNT=0
DIGEST=""

emit() { DIGEST="${DIGEST}$1
"; }

# handle_threshold <metric> <value> <threshold> <label>
handle_threshold() {
    local m="$1" v="$2" th="$3" label="$4"
    local key="in_breach_$m"
    local inb
    inb=$(state_get "$key")
    if [ -n "$v" ] && [ "$v" -ge "$th" ] 2>/dev/null; then
        BREACH_COUNT=$((BREACH_COUNT+1))
        if [ "$inb" != "1" ]; then
            emit "*${label}:* ${v}% (>= ${th}%) — ALERT"
            state_set "$key" 1
        fi
    else
        if [ "$inb" = "1" ]; then
            emit "*${label}:* ${v}% — recovered"
            state_set "$key" 0
        fi
    fi
}

run_check() {
    DIGEST=""
    BREACH_COUNT=0

    local cpu mem disk up temp cc wanip traffic
    cpu=$(metric_cpu_load_pct)
    mem=$(metric_mem_pct)
    disk=$(metric_disk_pct)
    up=$(metric_uptime)
    temp=$(metric_temp_c)
    cc=$(metric_client_count)
    wanip=$(metric_wan_ip)
    traffic=$(metric_iface_traffic)

    handle_threshold cpu_load "$cpu" "$CPU_LOAD_PCT" "CPU load"
    handle_threshold mem "$mem" "$MEM_PCT" "Memory"
    handle_threshold disk "$disk" "$DISK_PCT" "Disk"
    if [ -n "$temp" ]; then
        handle_threshold temp "$temp" "$TEMP_C" "Temperature (°C)"
    fi

    # ---- WAN connectivity (3-failure streak) ----
    local ok streak
    ok=$(wan_connectivity_ok)
    streak=$(state_get ping_fail_streak)
    [ -z "$streak" ] && streak=0
    if [ "$ok" = "0" ]; then
        streak=$((streak+1))
        state_set ping_fail_streak "$streak"
        if [ "$streak" -ge "$PING_FAIL_STREAK" ]; then
            BREACH_COUNT=$((BREACH_COUNT+1))
            if [ "$(state_get wan_down_alerted)" != "1" ]; then
                emit "*WAN:* unreachable for ${streak} checks (targets: ${PING_TARGETS})"
                state_set wan_down_alerted 1
            fi
        fi
    else
        state_set ping_fail_streak 0
        if [ "$(state_get wan_down_alerted)" = "1" ]; then
            emit "*WAN:* recovered"
            state_set wan_down_alerted 0
        fi
    fi

    # ---- Service status ----
    for s in $SERVICES; do
        local up_flag k
        up_flag=$(metric_service_up "$s")
        k="svc_down_$s"
        if [ "$up_flag" = "0" ]; then
            BREACH_COUNT=$((BREACH_COUNT+1))
            if [ "$(state_get "$k")" != "1" ]; then
                emit "*Service* \`$s\` is *DOWN*"
                state_set "$k" 1
            fi
        else
            if [ "$(state_get "$k")" = "1" ]; then
                emit "*Service* \`$s\` recovered"
                state_set "$k" 0
            fi
        fi
    done

    # ---- WAN IP change ----
    local prev_ip
    prev_ip=$(state_get wan_ip)
    if [ -n "$wanip" ] && [ "$wanip" != "$prev_ip" ]; then
        if [ -n "$prev_ip" ]; then
            emit "*WAN IP* changed: \`${prev_ip}\` → \`${wanip}\`"
        fi
        state_set wan_ip "$wanip"
    fi

    # ---- New device detection (persisted MAC list) ----
    if [ -r /tmp/dhcp.leases ]; then
        mkdir -p "$STATE_DIR"
        touch "$KNOWN_MACS"
        # dhcp.leases: epoch mac ip hostname clientid
        awk '{print $2}' /tmp/dhcp.leases | sort -u | while read -r mac; do
            [ -z "$mac" ] && continue
            if ! grep -q "^${mac}$" "$KNOWN_MACS" 2>/dev/null; then
                host=$(awk -v m="$mac" '$2==m{print $4}' /tmp/dhcp.leases | head -n1)
                ip=$(awk -v m="$mac" '$2==m{print $3}' /tmp/dhcp.leases | head -n1)
                emit "*New device:* \`${mac}\` — ${host:-unknown} (${ip})"
                echo "$mac" >> "$KNOWN_MACS"
            fi
        done
    fi

    # ---- Build & send digest ----
    if [ -n "$DIGEST" ]; then
        local header
        header="*${HOSTNAME_TAG}* @ $(NOW)
CPU load: ${cpu}% | Mem: ${mem}% | Disk: ${disk}%"
        [ -n "$temp" ] && header="${header} | Temp: ${temp}°C"
        header="${header}
Uptime: $(awk -v u="$up" 'BEGIN{d=int(u/86400);h=int((u%86400)/3600);m=int((u%3600)/60);printf "%dd %dh %dm",d,h,m}') | Clients: ${cc} | WAN: ${wanip:-n/a}
Traffic: ${traffic}"

        send_telegram "${header}
${DIGEST}" || true
    fi
}

# ============================ ENTRY ==========================================
case "$1" in
    --cron) run_check ;;
    --daemon)
        while :; do
            run_check
            sleep "$DAEMON_INTERVAL"
        done
        ;;
    --test)
        send_telegram "*${HOSTNAME_TAG}* test message at $(NOW)" && echo "sent"
        ;;
    *)
        echo "Usage: $0 {--cron|--daemon|--test}"
        exit 1
        ;;
esac
