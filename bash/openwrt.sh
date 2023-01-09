# Install dependencies
sudo apt install build-essential nano ccache ecj fastjar file g++ gawk gettext git java-propose-classpath libelf-dev libncurses5-dev libncursesw5-dev libssl-dev python python2.7-dev python3 unzip wget python3-distutils python3-setuptools python3-dev rsync subversion swig time xsltproc zlib1g-dev -y
# Clone OpenWRT source code
cd ~
git clone https://github.com/openwrt/openwrt.git -b v22.03.3 --depth 1
# Clone WLAN driver and packages
cd openwrt/
git clone https://github.com/Azexios/openwrt-r3p-mtk.git --depth 1
rsync -av ./openwrt-r3p-mtk/target/ ./target && rsync -av --delete ./openwrt-r3p-mtk/package/mt/ ./package/mt
git clone https://github.com/NagaseKouichi/luci-app-dnsproxy.git package/luci-app-dnsproxy
# Install packages
./scripts/feeds update -a && ./scripts/feeds install -a
# Change default IP
sed -i 's/192.168.1.1/192.168.41.1/g' package/base-files/files/bin/config_generate
