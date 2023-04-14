#!/bin/sh

TARGET_SET='pbr_wan_4_dst_ip_user'
TARGET_IPSET='pbr_wan_4_dst_net_user'
TARGET_TABLE='inet fw4'
TARGET_URL="http://www.ipdeny.com/ipblocks/data/countries/vn.zone"
TARGET_DL_FILE="/var/pbr_tmp_vn_ip_ranges"
TARGET_NFT_FILE="/var/pbr_tmp_vn_ip_ranges.nft"
[ -z "$nft" ] && nft="$(command -v nft)"
_ret=1

if [ ! -s "$TARGET_DL_FILE" ]; then
	uclient-fetch --no-check-certificate -qO- "$TARGET_URL" 2>/dev/null > "$TARGET_DL_FILE"
fi

if [ -s "$TARGET_DL_FILE" ]; then
	if ipset -q list "$TARGET_IPSET" >/dev/null 2>&1; then
		if awk -v ipset="$TARGET_IPSET" '{print "add " ipset " " $1}' "$TARGET_DL_FILE" | ipset restore -!; then
			_ret=0
		fi
	elif [ -n "$nft" ] && [ -x "$nft" ] && "$nft" list set "$TARGET_TABLE" "$TARGET_SET" >/dev/null 2>&1; then
		printf "add element %s %s { " "$TARGET_TABLE" "$TARGET_SET" > "$TARGET_NFT_FILE"
		awk '{printf $1 ", "}' "$TARGET_DL_FILE" >> "$TARGET_NFT_FILE"
		printf " } " >> "$TARGET_NFT_FILE"
		if "$nft" -f "$TARGET_NFT_FILE"; then
			rm -f "$TARGET_NFT_FILE"
			_ret=0
		fi
	fi
fi

return $_ret
