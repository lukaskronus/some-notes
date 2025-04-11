# OrangePi R1 - Boot from SPI Flash

## Idea
(Obsoleted) Proof of OrangePi R1 booting from SPI
```txt
https://forum.armbian.com/topic/8111-orange-pi-zero-plus-spi-nor-flash-anyone-know-how-to-configure-for-booting/?do=findComment&comment=102371
```

## Hardware

- [OrangePi R1](https://wikidevi.wi-cat.ru/Orange_Pi_R1)
  - 256 MiB RAM
  - 16 MiB SPI flash chip (Macronix chip, spi-jedec-nor)
- SD card reader
- Serial debug USB

## Software

- [Armbian Bookworm](https://www.armbian.com/orange-pi-r1/)
- [TeraTerm](https://github.com/TeraTermProject/teraterm) or you can use PuTTy
- [Balena Etcher](https://etcher.balena.io/)

## Prepare U-Boot

1. Compile new u-boot for Armbian Bookworm
- The pre-built u-boot does not support OrangePi Zero/R1 expansion board
- OrangePi R1 does not have any USB port without the expansion board

2. Clone Armbian Build Framework
```bash
# Latest stable version, can change it to newer version
git clone --depth=1 --branch=v24.11 https://github.com/armbian/build
cd build
./compile.sh BOARD="orangepi-r1" BRANCH="current" RELEASE="bookworm" BUILD_MINIMAL="yes" BUILD_DESKTOP="no" uboot-config
# Select Device Drivers -> MTD Device -> SPI flash -> Macronix
```

3. Create a new `orangepi-r1-expansion-board.patch` file in `userpatches/u-boot/u-boot-sunxi/` (`userpatches` will be available after first run `./compile.sh` command)

```diff
--- a/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
+++ b/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
@@ -68,6 +68,14 @@
  };
 };
 
+&ehci2 {
+ status = "okay";
+};
+
+&ehci3 {
+ status = "okay";
+};
+
 &spi0 {
  status = "okay";
 
@@ -85,6 +93,14 @@
  status = "disabled";
 };
 
+&ohci2 {
+ status = "okay";
+};
+
+&ohci3 {
+ status = "okay";
+};
+
 &mmc1 {
  vmmc-supply = <&reg_vcc3v3>;
  vqmmc-supply = <&reg_vcc3v3>;
```

4. (Optional) Another dts patch with power supply pin (according 26-pi layout on Orange Pi R1). This patch can replace the above one.
```diff
--- a/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
+++ b/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
@@ -64,6 +64,24 @@
                gpio = <&pio 0 20 GPIO_ACTIVE_HIGH>;
        };

+       /* VBUS regulator for USB2 on expansion board */
+       reg_vcc_usb2: reg-vcc-usb2 {
+               compatible = "regulator-fixed";
+               regulator-min-microvolt = <5000000>;
+               regulator-max-microvolt = <5000000>;
+               regulator-name = "vcc-usb2";
+               vin-supply = <&reg_vcc5v0>; /* Assuming 5V from GPIO header */
+       };
+
+       /* VBUS regulator for USB3 on expansion board */
+       reg_vcc_usb3: reg-vcc-usb3 {
+               compatible = "regulator-fixed";
+               regulator-min-microvolt = <5000000>;
+               regulator-max-microvolt = <5000000>;
+               regulator-name = "vcc-usb3";
+               vin-supply = <&reg_vcc5v0>; /* Assuming 5V from GPIO header */
+       };
+
        aliases {
                ethernet1 = &rtl8189etv;
        };
@@ -77,6 +95,17 @@
        };
 };

+/* Enable USB2 port on expansion board */
+&ehci2 {
+       status = "okay";
+};
+
+/* Enable USB3 port on expansion board */
+&ehci3 {
+       status = "okay";
+};
+
+/* OHCI for USB2 low/full-speed devices */
 &ohci1 {
        /*
         * RTL8152B USB-Ethernet adapter is connected to USB1,
@@ -86,6 +115,15 @@
        status = "disabled";
 };

+/* OHCI for USB2 on expansion board */
+&ohci2 {
+       status = "okay";
+};
+
+/* OHCI for USB3 on expansion board */
+&ohci3 {
+       status = "okay";
+};
 &mmc1 {
        vmmc-supply = <&reg_vcc3v3>;
        vqmmc-supply = <&reg_vcc3v3>;
@@ -97,4 +135,9 @@

 &usbphy {
        usb1_vbus-supply = <&reg_vcc_usb_eth>;
+       usb2_vbus-supply = <&reg_vcc_usb2>;
+       usb3_vbus-supply = <&reg_vcc_usb3>;
 };
+
+/* Reference to 5V supply, assumed available from GPIO header */
+&reg_vcc5v0 {};
```

5. Compile uboot and the compiled uboot is in `output/debs/linux-u-boot-*`
```bash
./compile.sh CLEAN_LEVEL="debs,alldebs" BOARD="orangepi-r1" BRANCH="current" RELEASE="bookworm" BUILD_MINIMAL="yes" BUILD_DESKTOP="no" uboot
```
   
## Connect serial debug USB

OrangePi R1 pin layout

GPIO (26-pin header) - TX - RX - GND

```bash
# serial modem on /dev/ttyUSB0
sudo minicom -s -D /dev/ttyUSB0 -b 115200 --color=on
```
## Install u-boot & Activate SPI NOR flash

- Run Armbian on OrangePi R1 by SD card
- Move the compiled u-boot deb file to the board
- Install new u-boot by `dpkg -i ./u-boot.deb`
- Run command `nand-sata-install` and update new u-boot
- Edit file `/boot/armbianEnv.txt` and add `spi-jedec-nor` to `overlays`
```bash
overlays=usbhost2 usbhost3 spi-jedec-nor
```
- Power off the board, unplug power source, and reboot

After reboot, check the SPI NOR by command

```bash
>ls -l /proc/mtd0
crw------- 1 root root 90, 0 Mar 27 21:17 /dev/mtd0
```
### **IN CASE YOU ALREADY FLASH U-BOOT TO SPI MEMORY**
- Install new `u-boot.deb` compiled
- Add `spi-jedec-nor` to `/boot/armbianEnv.txt`
- Reboot the board (unplug/plug again)
- Flash new `u-boot` to SPI memory by following the next step below

## Erase & Flash U-Boot to SPI Flash chip

```bash
# Check SPI flash info
mtd_debug info /dev/mtd0

# Erase entirely SPI flash chip
flash_erase /dev/mtd0 0 0

# Write u-boot to SPI flash chip
# The path may be incorrect but you can find u-boot-sunxi-with-spl.bin in /usr/lib/linux-u-boot
nandwrite -p /dev/mtd0 /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin

# In old kernel, you can use command flashcp -v /dev/mtd0 /dev/mtd0 /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin
```

## System on USB

You can flash armbian directly to your USB with Balena Etcher. Then, plug your USB to the board.
The board will load u-boot from SPI flash, then load `boot.scr` from USB flash drive.

## Troubleshooting

- You can check if the u-boot is written properly to SPI by following commands:

```bash
>mtd_debug read /dev/mtd0 0 503668 ./current.bin
# 503668 is the size of u-boot-sunxi-with-spl.bin
# You can find the exact size by command ls -l /usr/lib/linux-u-boot-current-orangepi-r1_armhf/

>cmp /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin ./current.bin
# No output means good
```

- Connect the board with Serial USB UART for more detail in bootloader.

## Complete

```bash
shutdown -Fh now
# Unplug the power adapter
# Remove the sd card
# Reboot
```
The board should boot from SPI flash and system on USB.
