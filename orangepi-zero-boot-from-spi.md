# Orange Pi Zero LTS Boot from SPI

## Original source

```txt
https://forum.armbian.com/topic/3252-opi-zero-boot-with-spi/
https://github.com/MathiasStadler/orange-pi-zero-boot-from-spi
```

## Hardware

- [OrangePi Zero LTS](http://www.orangepi.org/orangepizero/)
  - 512 MByte version
  - The LTS version has 2MB SPI memory
- USB Flash Drive
- SD Memory card reader

## OS

- [ARMBIAN Bookworm](https://www.armbian.com/orange-pi-zero/)

## How to do

1. Flash and boot armbian from SD card

2. Connect serial console at start minicom

```bash
# serial modem on /dev/ttyUSB0
sudo minicom -s -D /dev/ttyUSB0 -b 115200 --color=on
```

3. Activate overlay for SPI Bus

- Edit in file `/boot/armbianEnv.txt` and add `spi-spidev` AND `param_spidev_spi_bus=0`

```bash
# Should look like this
overlays=analog-codec usbhost2 usbhost3 spi-spidev
param_spidev_spi_bus=0
```
- Or you can run this bash script

```bash
ARMBIAN_ENV_FILE="/boot/armbianEnv.txt"
if sudo grep spi-spidev $ARMBIAN_ENV_FILE; then
echo "[ok] found spi-spidev"
else
echo "[missing] NOT found spi-spidev"
echo "[todo] add spi-spidev"
sudo sed  -i '/overlays=/s/$/ spi-spidev/' $ARMBIAN_ENV_FILE
echo "param_spidev_spi_bus=0"|sudo tee -a $ARMBIAN_ENV_FILE
fi
```

- Result `/boot/armbianEnv.txt`

```bash
verbosity=1
logo=disabled
console=both
disp_mode=1920x1080p60
overlay_prefix=sun8i-h3
overlays=usbhost2 usbhost3
rootdev=UUID=84168f41-20b8-4905-9021-54488d09dc33
rootfstype=ext4
overlays=analog-codec usbhost2 usbhost3 spi-spidev
param_spidev_spi_bus=0
usbstoragequirks=0x2537:0x1066:u,0x2537:0x1068:u
```

4. Shutdown your board

```bash
sudo shutdown -Fh now
# unplug/plug the power adapter and start again
```

5. **AFTER THE COLD REBOOT**: You should see the spi device under `/dev`

```bash
>ls -l /dev/spidev0.0
crw------- 1 root root 153, 0 Nov 10 21:17 /dev/spidev0.0
```

6. Install flashrom
```bash
sudo apt update && sudo apt upgrade && sudo apt autoremove
sudo apt-get install flashrom
```

7. Copy/Paste each following command lines
```bash
# Create empty image
sudo dd if=/dev/zero count=2048 bs=1K | tr '\000' '\377' > spi.img
# ATTENTION: Check your board's SPI memory size. Usually, it is 2MiB or 2048K but might be different on yours.

# Write the u-boot from SD card to created empty image
# The path may be incorrect on newer Armbian version but you can find the `u-boot-sunxi-with-spl.bin` in `/usr/lib/linux-u-boot/`
sudo dd if=/usr/lib/linux-u-boot-next-orangepizero_armhf/u-boot-sunxi-with-spl.bin of=spi.img bs=1k conv=notrunc

# Flash the image to SPI memory
sudo flashrom -p linux_spi:dev=/dev/spidev0.0 -w spi.img -c MX25L1605A/MX25L1606E/MX25L1608E
```
**DO NOT REBOOT YOUR BOARD AFTER FLASHING SPI MEMORY**

8. Connect your USB to your board

```bash
# Move OS System to USB
# Do not reboot your board at this moment
sudo nand-sata-install

# Mount the pendrive/stick
sudo mount /dev/sda1 /mnt

# Overwrite boot overlay
sudo cp -a /boot /mnt

# Edit /mnt/boot/boot.cmd and set the rootdev from usb device
setenv rootdev "/dev/sda1"

# Create a new boot.scr on the boot device
sudo mkimage -C none -A arm -T script -d /mnt/boot/boot.cmd /mnt/boot/boot.scr

# Save /mnt/etc/fstab
sudo cp /mnt/etc/fstab /mnt/etc/fstab_save

# Edit /mnt/etc/fstab and uncomment all line with /media/mmcboot
sudo sed -i '/mmcboot/s/^/#/' /mnt/etc/fstab


# and ADD the the boot partition to /mnt/etc/fstab
printf "UUID=%s\t/\t%s\tdefaults,noatime,nodiratime,commit=600,errors=remount-ro,x-gvfs-hide\t0\t1" $(sudo blkid /dev/sda1 -o value -s UUID) $(sudo blkid /dev/sda1 -o value -s TYPE)|sudo tee -a /mnt/etc/fstab

```

9. Shutdown your board

```bash
sudo shutdown -Fh now
```

Now you can boot Orange Pi Zero from USB without SD Card

## Troubleshooting

- The first 100 byte of the `spi.img` must the same as the `u-boot-sunxi-with-spl.bin`

```bash
>hexdump -C -n100 spi.img
00000000  16 00 00 ea 65 47 4f 4e  2e 42 54 30 d5 5b 4c 75  |....eGON.BT0.[Lu|
00000010  00 60 00 00 53 50 4c 02  00 00 00 00 00 00 00 00  |.`..SPL.........|
00000020  2c 00 00 00 00 00 00 00  00 00 00 00 73 75 6e 38  |,...........sun8|
00000030  69 2d 68 32 2d 70 6c 75  73 2d 6f 72 61 6e 67 65  |i-h2-plus-orange|
00000040  70 69 2d 7a 65 72 6f 00  00 00 00 00 00 00 00 00  |pi-zero.........|
00000050  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
00000060  0f 00 00 ea                                       |....|

> hexdump -C -n100 /usr/lib/linux-u-boot-next-orangepizero_5.65_armhf/u-boot-sunxi-with-spl.bin
00000000  16 00 00 ea 65 47 4f 4e  2e 42 54 30 d5 5b 4c 75  |....eGON.BT0.[Lu|
00000010  00 60 00 00 53 50 4c 02  00 00 00 00 00 00 00 00  |.`..SPL.........|
00000020  2c 00 00 00 00 00 00 00  00 00 00 00 73 75 6e 38  |,...........sun8|
00000030  69 2d 68 32 2d 70 6c 75  73 2d 6f 72 61 6e 67 65  |i-h2-plus-orange|
00000040  70 69 2d 7a 65 72 6f 00  00 00 00 00 00 00 00 00  |pi-zero.........|
00000050  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
00000060  0f 00 00 ea                                       |....|
```

- After flasing to SPI memory, you can re-read data

```bash
# Dump SPI rom to image
>sudo flashrom -p linux_spi:dev=/dev/spidev0.0 -r spi_read.img -c MX25L1605A/MX25L1606E/MX25L1608E
```
The hexdump of the `spi_read.img` must be the same as the `spi.img`

```bash
>md5sum spi.img 
c61f5c3823f1752d59505148ce90ae89  spi.img
>md5sum spi_read.img 
c61f5c3823f1752d59505148ce90ae89  spi_read.img
```

## Delete SPI rom/Enable SD Card booting

- Delete u-boot from SPI memory

```bash
# erase
sudo flashrom -p linux_spi:dev=/dev/spidev0.0 -E -c MX25L1605A/MX25L1606E/MX25L1608E
# check it empty
sudo flashrom -p linux_spi:dev=/dev/spidev0.0 -r spi_read.img -c MX25L1605A/MX25L1606E/MX25L1608E
hexdump -C -n100 spi_read.img
00000000  ff ff ff ff ff ff ff ff  ff ff ff ff ff ff ff ff  |................|
# you should see a collection of null
```
