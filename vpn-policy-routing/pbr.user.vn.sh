#!/bin/sh
# Route all Vietnam destinations via WAN
# OpenWrt 25.02 + pbr package

TARGET_TABLE='inet fw4'
TARGET_INTERFACE='wan'

IPV4_URL='https://www.ipdeny.com/ipblocks/data/countries/vn.zone'
IPV6_URL='https://www.ipdeny.com/ipv6/ipaddresses/blocks/vn.zone'

TMP_DIR='/var/pbr_tmp'
IPV4_FILE="$TMP_DIR/vn_ipv4.zone"
IPV6_FILE="$TMP_DIR/vn_ipv6.zone"

_ret=0

mkdir -p "$TMP_DIR"

# Download latest lists
uclient-fetch -qO "$IPV4_FILE" "$IPV4_URL" || _ret=1

if [ "$(uci -q get pbr.config.ipv6_enabled)" = "1" ]; then
    uclient-fetch -qO "$IPV6_FILE" "$IPV6_URL" || _ret=1
fi

[ $_ret -eq 0 ] || return 1

# IPv4
if [ -s "$IPV4_FILE" ]; then
    nftset="pbr_${TARGET_INTERFACE}_4_dst_ip_user"

    nft add element "$TARGET_TABLE" "$nftset" \
    "{ $(tr '\n' ',' < "$IPV4_FILE" | sed 's/,$//') }" \
    || _ret=1
fi

# IPv6
if [ "$(uci -q get pbr.config.ipv6_enabled)" = "1" ] && [ -s "$IPV6_FILE" ]; then
    nftset="pbr_${TARGET_INTERFACE}_6_dst_ip_user"

    nft add element "$TARGET_TABLE" "$nftset" \
    "{ $(tr '\n' ',' < "$IPV6_FILE" | sed 's/,$//') }" \
    || _ret=1
fi

return $_ret
