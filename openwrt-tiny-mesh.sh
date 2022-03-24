make image PROFILE=tplink_tl-wr841-v11 PACKAGES="uhttpd uhttpd-mod-ubus libiwinfo-lua luci-base luci-mod-admin-full \
wpad -wpad-mini -wpad-basic-wolfssl \
luci-theme-material -luci-theme-bootstrap \
-firewall -luci-app-firewall -ppp -ppp-mod-pppoe \
-ip6tables -odhcp6c -kmod-ipv6 -kmod-ip6tables -odhcpd-ipv6only \
-dnsmasq -odhcpd -iptables \
-kmod-ipt-conntrack -kmod-ipt-core -kmod-ipt-nat -kmod-ipt-offload \
-kmod-nf-conntrack -kmod-nf-conntrack6 -kmod-nf-flow -kmod-nf-ipt -kmod-nf-nat -kmod-nf-reject \
-ca-bundle -opkg -luci-app-opkg"
