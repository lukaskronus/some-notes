#!/bin/sh

check_ping () {
  server="$1"
  interface="$2"
  count=0
  while [ "$count" -lt 5 ]; do
    ping_output=$(ping "$server" -c 1 -I "$interface" -W 5)
    ping_time=$(printf "%.0f" "$(echo "$ping_output" | grep 'time=' | awk -F 'time=' '{print $2}' | awk '{print $1}')")
    if [ -n "$ping_time" ] && [ "$ping_time" -gt 0 ]; then
      break
    fi
    count=$((count+1))
    sleep 1
  done
}

find_fastest_server () {
  server_list="/etc/servers"
  fastest_ping=100
  fastest_server=
  interface="br-lan"
  while IFS= read -r server; do
    check_ping "$server" "$interface" &>/dev/null
    if [ "$ping_time" -lt "$fastest_ping" ]; then
      fastest_server="$server"
      fastest_ping="$ping_time"
    fi
  done < "$server_list"
}

ifname="nordlynx"
check_ping "8.8.8.8" "$ifname" &>/dev/null

# Check if VPN ping is lower than 50ms
if [ "$ping_time" -eq 0 ] || [ "$ping_time" -lt 10 ]; then
  exit 0
else
  find_fastest_server
  echo "Fastest server: $fastest_server"
  echo "Fastest ping: $fastest_ping ms"
  uci set network.@wireguard_${ifname}[-1].endpoint_host="$fastest_server"
  uci commit network
  /etc/init.d/network restart
fi

exit 0
