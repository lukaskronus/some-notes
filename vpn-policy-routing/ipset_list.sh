#!/bin/sh

mylist="/etc/mylist"
ipv4_list="list4"
ipv6_list="list6"

reset_ipset_lists() {
    if ipset list $ipv4_list >/dev/null 2>&1 && ipset list $ipv6_list >/dev/null 2>&1; then
        ipset destroy $ipv4_list >/dev/null 2>&1
        ipset destroy $ipv6_list >/dev/null 2>&1
    fi
    ipset create $ipv4_list hash:net family inet >/dev/null 2>&1
    ipset create $ipv6_list hash:net family inet6 >/dev/null 2>&1
}
reset_ipset_lists

while read line; do
    # Check if the line is a domain, resolve it to get its IPv4 and IPv6 addresses
    if echo "$line" | grep -Eq '^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$'; then
        # If the line is a domain, resolve it to get its IPv4 and IPv6 addresses
        ipv4=$(resolveip -4 $line | awk '{print $NF}')
        ipv6=$(resolveip -6 $line | awk '{print $NF}')
        if [ -n "$ipv4" ]; then
            echo "$ipv4" | xargs -n 1 ipset add $ipv4_list
        fi
        if [ -n "$ipv6" ]; then
            echo "$ipv6" | xargs -n 1 ipset add $ipv6_list
        fi
    # If the line is an IPv4 CIDR block, add it to the IPv4 list
    elif echo "$line" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$'; then
        ipset add $ipv4_list $line
    # If the line is an IPv6 CIDR block, add it to the IPv6 list
    elif echo "$line" | grep -Eq '^[a-fA-F0-9:]+/[0-9]+$'; then
        ipset add $ipv6_list $line
    else
        echo "Invalid line: $line"
    fi
done < "$mylist"
