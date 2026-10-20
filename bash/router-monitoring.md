# How to deploy monitoring scrip

### 1. Prepare the state directory
```
mkdir -p /etc/telegram-alerts
chmod 700 /etc/telegram-alerts
```

The state file and known-MAC list live here and survive reboots (flash).

### 2. Install the script
```
cat > /usr/bin/telegram-alerts.sh   # paste script above
chmod 755 /usr/bin/telegram-alerts.sh
```

Edit `BOT_TOKEN` and `CHAT_ID` inside the script (per your answer — token stored as a shell variable).

### 3. Verify Telegram connectivity
```
/usr/bin/telegram-alerts.sh --test
```

You should get a "test message" in your personal chat. If not, check `ca-bundle` is installed (`opkg list-installed | grep ca-bundle`) and that the token/chat ID are correct.

### 4. Add the cron entry
```
cat >> /etc/crontabs/root <<'EOF'
*/5 * * * * /usr/bin/telegram-alerts.sh --cron
EOF
/etc/init.d/cron restart
```

### 5. (Optional) Run as an init.d daemon instead of cron
If you prefer the loop mode, use this init script — do **not** also enable cron:

```
cat > /etc/init.d/telegram-alerts <<'EOF'
#!/bin/sh /etc/rc.common
START=95
STOP=10
USE_PROCD=1

start_service() {
    procd_open_instance
    procd_set_param command /usr/bin/telegram-alerts.sh --daemon
    procd_set_param respawn 3600 5 5
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance
}
EOF
chmod 755 /etc/init.d/telegram-alerts
/etc/init.d/telegram-alerts enable
/etc/init.d/telegram-alerts start
```

### 6. Tune thresholds
Edit the `CONFIG` block: `CPU_LOAD_PCT`, `MEM_PCT`, `DISK_PCT`, `TEMP_C`, `PING_FAIL_STREAK`, `SERVICES`, `IFACES`. Defaults are 80% per your answer.

