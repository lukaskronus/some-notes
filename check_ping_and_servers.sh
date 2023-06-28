#!/bin/sh

check_ping () {
  server="$1"
  interface="$2"
  ping_result=$(ping -c 1 -I "$interface" -W 10 "$server" | grep 'time=' | awk -F 'time=' '{print $2}' | awk '{print $1}')
  if [ -z "$ping_result" ]; then
    # Error handling on ping failed
    echo "Error: ping to $server failed or timed out"
    exit 1
  fi
}

find_fastest_server () {
  server_list="/etc/servers"
  fastest_server=""
  # Threshold for fastest_ping
  fastest_ping=999999
  # Replace with the name of your WAN interface
  interface="wan"

  while read -r server; do
    ping_result=$(check_ping "$server" "$interface")
    if [ -n "$ping_result" ] && [ "$ping_result" -lt "$fastest_ping" ]; then
      fastest_server="$server"
      fastest_ping="$ping_result"
    fi
  done < "$server_list"
}

interface="nordlynx"
if [ "$(check_ping "google.com" "$interface")" -lt 50 ]; then
  exit 0    
else
  fastest_server=""
  find_fastest_server
  uci set network.${interface}.endpoint_host="$fastest_server"
  if ! uci commit network; then
    # Error handling on commit network
    echo "Error: Failed to commit network changes"
    exit 1
  fi
  if ! /etc/init.d/network restart; then
    # Error handling on commit network
    echo "Error: Failed to restart the network"
    exit 1
  fi
fi

exit 0
