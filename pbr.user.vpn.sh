#!/bin/sh

TARGET_TABLE='inet fw4'
TARGET_DL_FILE="/usr/share/pbr/localip"
TARGET_NFT_FILE="/var/local.nft"
[ -z "$nft" ] && nft="$(command -v nft)"
_ret=1

if [ -s "$TARGET_DL_FILE" ]; then
	# Check if surf and nord WG interfaces is up
	if ip link show surf up >/dev/null 2>&1; then
		TARGET_SET='pbr_surf_4_src_ip_user'
		TARGET_IPSET='pbr_surf_4_src_net_user'
	elif ip link show nord up >/dev/null 2>&1; then
		TARGET_SET='pbr_nord_4_src_ip_user'
		TARGET_IPSET='pbr_nord_4_src_net_user'
	# If both interfaces are down, back to wan
  else
		TARGET_SET='pbr_wan_4_src_ip_user'
		TARGET_IPSET='pbr_wan_4_src_net_user'
		_ret=0
	fi
	
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
