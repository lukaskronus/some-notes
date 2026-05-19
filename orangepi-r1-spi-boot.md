# OrangePi R1 - Boot from SPI Flash

## Idea
Proof of OrangePi R1 booting from SPI NOR flash using Armbian Bookworm and a custom-compiled U-Boot.

> **Reference:** https://forum.armbian.com/topic/8111-orange-pi-zero-plus-spi-nor-flash-anyone-know-how-to-configure-for-booting/?do=findComment&comment=102371

---

## Hardware

- [OrangePi R1](https://wikidevi.wi-cat.ru/Orange_Pi_R1)
  - 256 MiB RAM
  - 16 MiB SPI flash chip (Macronix, spi-jedec-nor)
- SD card reader
- Serial debug USB (USB-UART adapter)

## Software

- [Armbian Bookworm](https://www.armbian.com/orange-pi-r1/)
- [TeraTerm](https://github.com/TeraTermProject/teraterm) or PuTTY (Windows) / minicom (Linux)
- [Balena Etcher](https://etcher.balena.io/)

---

## Prepare U-Boot

> **Why compile?** The pre-built U-Boot does not support the OrangePi R1 expansion board, which provides the only USB ports on the board.

### 1. Clone the Armbian Build Framework

```bash
git clone --depth=1 https://github.com/armbian/build
cd build
```

> You no longer need to pin a specific release tag. The `main` branch is now stable and recommended. If you want a specific release (e.g. v25.x), you can add `--branch=v25.05` (check [releases](https://github.com/armbian/build/releases) for the latest tag).

### 2. Configure U-Boot (menuconfig)

The old `uboot-config` command has been **renamed** to `uboot-patch` in newer Armbian build framework versions. To open the U-Boot menuconfig and enable the Macronix SPI flash driver:

```bash
./compile.sh uboot-patch BOARD="orangepi-r1" BRANCH="current" RELEASE="bookworm"
# In menuconfig: Device Drivers → MTD Device → SPI flash → Macronix
```

### 3. Add the Expansion Board Device Tree Patch

Create the patch file at:
```
userpatches/u-boot/u-boot-sunxi-current/orangepi-r1-expansion-board.patch
```

> The `userpatches/` directory is created automatically after your first `./compile.sh` run.

This patch enables the USB2 and USB3 host controller ports (EHCI/OHCI) on the expansion board. That's all that's needed — the expansion board's VBUS is hardwired to the board's 5V supply with no GPIO switching, so no software-controlled regulator nodes are required.

> **Note on USB 3.0 recognition:** If you previously experienced USB 3.0 not being detected, that is a power supply issue — use a good 5V/2A+ adapter. The patch itself is not the cause.

**Patch:**

```diff
--- a/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
+++ b/arch/arm/dts/sun8i-h2-plus-orangepi-r1.dts
@@ -77,6 +77,17 @@
        };
 };

+&ehci2 {
+       status = "okay";
+};
+
+&ehci3 {
+       status = "okay";
+};
+
 &ohci1 {
        status = "disabled";
 };

+&ohci2 {
+       status = "okay";
+};
+
+&ohci3 {
+       status = "okay";
+};
+
 &mmc1 {
        vmmc-supply = <&reg_vcc3v3>;
        vqmmc-supply = <&reg_vcc3v3>;
```

### 4. Compile U-Boot

```bash
./compile.sh uboot BOARD="orangepi-r1" BRANCH="current" RELEASE="bookworm" BUILD_MINIMAL="yes" BUILD_DESKTOP="no"
```

The compiled `.deb` package will appear in `output/debs/`.

> **Note:** The old `CLEAN_LEVEL="debs,alldebs"` flag and the combined config+compile single-liner are no longer needed. Configuration (step 2) and compilation (this step) are now separate commands.

---

## Connect Serial Debug USB

OrangePi R1 GPIO (26-pin header) — connect TX, RX, and GND pins to your USB-UART adapter.

```bash
# Linux — open serial console
sudo minicom -s -D /dev/ttyUSB0 -b 115200 --color=on
```

---

## Install U-Boot & Activate SPI NOR Flash

1. Boot Armbian on OrangePi R1 from SD card.
2. Copy the compiled `linux-u-boot-*.deb` to the board (e.g. via `scp`).
3. Install it:
   ```bash
   dpkg -i ./linux-u-boot-current-orangepi-r1_*.deb
   ```
4. Run the install tool and apply U-Boot to the boot slot:
   ```bash
   nand-sata-install
   ```
5. Enable the SPI overlay in `/boot/armbianEnv.txt`:
   ```
   overlays=usbhost2 usbhost3 spi-jedec-nor
   ```
6. Power off the board fully (unplug power), then reboot.

After reboot, verify the SPI NOR flash is detected:

```bash
ls -l /dev/mtd0
# Expected: crw------- 1 root root 90, 0 ...
```

> **Already have U-Boot flashed to SPI?** Install the new `.deb`, update `armbianEnv.txt`, reboot (unplug/replug), then re-flash as described in the next section.

---

## Erase & Flash U-Boot to SPI Flash

```bash
# Check SPI flash info
mtd_debug info /dev/mtd0

# Erase the entire SPI flash chip
flash_erase /dev/mtd0 0 0

# Write U-Boot to SPI flash
# Adjust the path if needed — find u-boot-sunxi-with-spl.bin under /usr/lib/linux-u-boot-*
nandwrite -p /dev/mtd0 /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin

# Older kernels may use flashcp instead:
# flashcp -v /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin /dev/mtd0
```

---

## Boot System from USB

Flash Armbian directly to a USB drive using Balena Etcher, then plug it into the board. U-Boot will load from SPI flash and then find `boot.scr` on the USB drive.

---

## Troubleshooting

**Verify U-Boot was written correctly:**
```bash
# Read back from SPI (replace 503668 with actual file size)
ls -l /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin
mtd_debug read /dev/mtd0 0 503668 ./current.bin

# Compare — no output means they match
cmp /usr/lib/linux-u-boot-current-orangepi-r1_armhf/u-boot-sunxi-with-spl.bin ./current.bin
```

**For detailed bootloader logs:** connect the Serial USB UART and watch the console output during boot.

---

## Final Boot (SPI + USB)

```bash
shutdown -Fh now
# Unplug the power adapter
# Remove the SD card
# Plug power back in
```

The board will boot U-Boot from SPI flash, then load the OS from the USB drive.
