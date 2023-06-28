#!/bin/sh

check_ping () {
  server="$1"
  interface="$2"
  ping_result=$(ping -c 1 -I "$interface" -W 10 "$server" | awk '/time=/ {print $NF}')
  if [ -z "$ping_result" ]; then
    echo "Error: ping to $server failed or timed out"
    exit 1
  fi
}

find_fastest_server () {
  server_list="/etc/servers"
  declare -g fastest_server=""
  fastest_ping=999999
  interface="wan" # Replace with the name of your WAN interface

  while read -r server; do
    ping_result=$(check_ping "$server" "$interface")
    if [ -n "$ping_result" ] && [ $(echo "$ping_result < $fastest_ping" | bc) -eq 1 ]; then
      fastest_server="$server"
      fastest_ping="$ping_result"
    fi
  done < "$server_list"
}

interface="nordlynx"
if [ $(echo "$(check_ping "google.com" "$interface") < 50" | bc) -eq 1 ]; then
  exit 0    
else
  find_fastest_server
  uci set network.${interface}.endpoint_host="$fastest_server"
  uci commit network
  /etc/init.d/network restart
fi

exit 0
