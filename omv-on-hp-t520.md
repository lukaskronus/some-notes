# Problem
After the OMV (Open Media Vault) installation on a USB, the PC doesn't seem to recognize it as bootable.</br>
For more detail, [read this](https://forum.openmediavault.org/index.php?thread/37846-installation-usb-boots-but-after-installation-target-usb-won-t-boot/&postID=394753#post394753).</br>

# Requirement
1. A live Linux ISO (For example: [Linux Mint](https://www.linuxmint.com/download_lmde.php))
2. Another USB for Live Linux

# Step
1. Boot to Live Linux ISO
2. Run these following commands (assume that your OMV usb is /dev/sda
```bash
mount /dev/sda2 /mnt && mount /dev/sda1 /mnt/boot/efi
cp -R /mnt/boot/efi/EFI/debian /mnt/boot/efi/EFI/BOOT 
mv /mnt/boot/efi/EFI/BOOT/grubx64.efi /mnt/boot/efi/EFI/BOOT/BOOTX64.EFI
umount /dev/sda1 && umount /dev/sda2
```
3. Run this command to create new boot order
```bash
efibootmgr --create --label 'OMV' --disk /dev/sda --part 1 --loader \EFI\BOOT\BOOTX64.EFI
```
4. (Optional) Use command `efibootmgr --order` correct booting order
