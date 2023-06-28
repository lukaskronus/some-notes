#!/bin/sh
# WIP
check_ping () {
  server="$1"
  interface="$2"
  ping_result=$(ping -c 1 -I "$interface" -W 10 "$server" | grep 'time=' | awk -F 'time=' '{print $2}' | awk '{print $1}')
  ping_time=$(printf "%.0f" "$ping_result")
}

find_fastest_server () {
  server_list="/etc/servers"
  fastest_server=""
  fastest_ping=-1
  # Replace with the name of your WAN interface
  interface="wan"

  while read -r server; do
    ping_result=$(check_ping "$server" "$interface")
    if [  $fastest_ping -eq -1 ] || [ "$ping_result" -lt "$fastest_ping" ]; then
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
