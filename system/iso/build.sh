#!/bin/bash
# Builds the bootable Nebulux OS .iso (BIOS and UEFI, Secure Boot ready).
# Runs as root inside a Debian 12 ("bookworm") container, for example:
#   docker run --rm --privileged -v "$PWD":/repo -w /repo debian:bookworm bash system/iso/build.sh
# What goes in: the Linux kernel and drivers (with Wi-Fi and Bluetooth firmware), the GRUB and ISOLINUX bootloaders
# with the Nebulux OS menu, a full-screen browser engine, NetworkManager and BlueZ, and Nebulux OS itself
# (/opt/nebulux). On start-up the computer logs in by itself and opens Nebulux OS full screen.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${OUT:-$REPO/out}"
WORK="${WORK:-/tmp/nxbuild}"
VERSION="${NX_VERSION:-1.0}"
say() { printf '\n=== %s ===\n' "$*"; }

say "Tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends live-build debootstrap squashfs-tools xorriso isolinux syslinux-common \
  grub-efi-amd64-bin grub-pc-bin mtools dosfstools ca-certificates cpio rsync >/dev/null

say "Config"
rm -rf "$WORK"; mkdir -p "$WORK" "$OUT"; cd "$WORK"
lb config \
  --distribution bookworm --architectures amd64 --binary-images iso-hybrid \
  --archive-areas "main contrib non-free-firmware" \
  --debian-installer none --apt-recommends false --apt-indices false \
  --bootloaders "syslinux,grub-efi" --uefi-secure-boot auto \
  --firmware-chroot true --firmware-binary false \
  --memtest none --security true --updates true --checksums sha256 --zsync false \
  --iso-application "Nebulux OS" --iso-publisher "Nebulux LLC" --iso-volume "NEBULUX_OS" \
  --image-name nebulux-os \
  --bootappend-live "boot=live components quiet splash loglevel=3 rd.udev.log_level=3 systemd.show_status=false vt.global_cursor_default=0 username=nebulux user-fullname=Nebulux hostname=nebulux-os locales=en_US.UTF-8 keyboard-layouts=us live-config.user-default-groups=audio,cdrom,dip,floppy,video,plugdev,netdev,powerdev,scanner,bluetooth,input,render persistence persistence-media=removable-usb" \
  >/dev/null

# what's installed
cp "$REPO/system/iso/packages.list" config/package-lists/nebulux.list.chroot
# files placed into the system
mkdir -p config/includes.chroot
cp -a "$REPO/system/iso/root/." config/includes.chroot/
mkdir -p config/includes.chroot/opt/nebulux/www config/includes.chroot/opt/nebulux/helper config/includes.chroot/opt/nebulux/ext
cp -a "$REPO/index.html" "$REPO/css" "$REPO/js" config/includes.chroot/opt/nebulux/www/
cp -a "$REPO/system/helper/nebulux-helper.js" config/includes.chroot/opt/nebulux/helper/
cp -a "$REPO/system/browser-ext/." config/includes.chroot/opt/nebulux/ext/
echo "$VERSION" > config/includes.chroot/opt/nebulux/VERSION
# setup steps run inside the system while it's built
cp "$REPO/system/iso/nebulux.hook.chroot" config/hooks/normal/9000-nebulux.hook.chroot
chmod +x config/hooks/normal/9000-nebulux.hook.chroot

# the boot menu: Nebulux OS names, the Nebulux picture, and a short wait
say "Boot menu"
mkdir -p config/bootloaders
for d in isolinux syslinux_common grub-pc; do
  [ -d "/usr/share/live/build/bootloaders/$d" ] && cp -a "/usr/share/live/build/bootloaders/$d" config/bootloaders/
done
find config/bootloaders -type f \( -name '*.cfg' -o -name '*.in' \) -print0 | xargs -0 sed -i \
  -e 's/Live system (@FLAVOUR@)/Nebulux OS/g' -e 's/Live system (fail-safe mode)/Nebulux OS (safe mode)/g' \
  -e 's/Live system/Nebulux OS/g' -e 's/Debian GNU\/Linux/Nebulux OS/g' -e 's/@FLAVOUR@)/)/g'
for f in config/bootloaders/isolinux/isolinux.cfg config/bootloaders/syslinux_common/isolinux.cfg; do
  [ -f "$f" ] && { sed -i 's/^timeout .*/timeout 30/' "$f"; grep -q '^timeout' "$f" || echo "timeout 30" >> "$f"; }
done
find config/bootloaders -name 'grub.cfg' -print0 | xargs -0 -r sed -i 's/set timeout=.*/set timeout=3/'
find config/bootloaders -name 'config.cfg' -path '*grub*' -print0 | xargs -0 -r sed -i 's/set timeout=.*/set timeout=3/'
for f in $(find config/bootloaders -name 'splash.png'); do cp "$REPO/system/iso/splash.png" "$f"; done
find config/bootloaders -name 'splash.svg' -delete
grep -rl "timeout" config/bootloaders | head -5 | while read -r f; do echo "--- $f"; grep -n "timeout\|menu label\|menuentry" "$f" | head -8; done

say "Build (this takes a while)"
lb build 2>&1 | tee "$OUT/build.log" | grep -E '^(P:|E:|W:)|error' | grep -v 'Hit:\|Get:' || true
ISO="$(ls -1 "$WORK"/*.iso 2>/dev/null | head -1)"
[ -n "$ISO" ] && [ -s "$ISO" ] || { echo "The .iso wasn't made. Last lines of the log:"; tail -60 "$OUT/build.log"; exit 1; }
mv "$ISO" "$OUT/nebulux-os.iso"
( cd "$OUT" && sha256sum nebulux-os.iso > nebulux-os.iso.sha256 )
ls -la "$OUT"
say "Done: $OUT/nebulux-os.iso"
