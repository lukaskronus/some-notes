#!/bin/sh

TARGET_TABLE='inet fw4'
TARGET_SET='pbr_warp_4_src_ip_user'
IP_SUBNETS="192.168.1.0/24 10.0.0.0/8 172.16.0.0/12"  # Add your subnets here
TARGET_NFT_FILE="/var/local.nft"
[ -z "$nft" ] && nft="$(command -v nft)"
_ret=1

if [ -n "$nft" ] && [ -x "$nft" ] && "$nft" list set "$TARGET_TABLE" "$TARGET_SET" >/dev/null 2>&1; then
    printf "add element %s %s { " "$TARGET_TABLE" "$TARGET_SET" > "$TARGET_NFT_FILE"

    # Loop through the IP subnets and add them to the nftables file
    for subnet in $IP_SUBNETS; do
        printf "%s, " "$subnet" >> "$TARGET_NFT_FILE"
    done

    printf " } " >> "$TARGET_NFT_FILE"

    # Apply the nftables rule
    if "$nft" -f "$TARGET_NFT_FILE"; then
        rm -f "$TARGET_NFT_FILE"
        _ret=0
    fi
fi

exit $_ret
