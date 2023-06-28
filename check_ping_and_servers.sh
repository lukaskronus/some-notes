#!/bin/sh

check_ping () {
  server="$1"
  interface="$2"
  ping_time=$(printf "%.0f" "$(ping -c 1 -I "$interface" -W 10 "$server" | grep 'time=' | awk -F 'time=' '{print $2}' | awk '{print $1}')")
}

find_fastest_server () {
  server_list="/etc/servers"
  fastest_ping=100
  fastest_server=
  interface="br-lan"

  while IFS= read -r server; do
    check_ping "$server" "$interface"
    if [ -n "$ping_time" ] && [ "$ping_time" -lt "$fastest_ping" ]; then
      fastest_server="$server"
      fastest_ping="$ping_time"
      sleep 2
    fi
  done < "$server_list"
}

ifname="nordlynx"
check_ping "google.com" "$ifname"
# Check if VPN ping is lower than 50ms
if [ "$ping_time" -lt 50 ]; then
  exit 0    
else
  find_fastest_server
  uci set network.@wireguard_${ifname}[-1].endpoint_host="$fastest_server"
  uci commit network
  /etc/init.d/network restart
fi

exit 0
