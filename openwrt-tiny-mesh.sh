# OpenWRT 18.06
make image PROFILE=tplink_tl-wr841-v11 PACKAGES="uhttpd uhttpd-mod-ubus libiwinfo-lua luci-base luci-mod-admin-full \
wpad kmod-batman-adv batctl-full -wpad-mini luci-theme-material -luci-theme-bootstrap -firewall -luci-app-firewall \
-ppp -ppp-mod-pppoe -ip6tables -odhcp6c -kmod-ipv6 -kmod-ip6tables -odhcpd-ipv6only -dnsmasq -odhcpd -iptables"
