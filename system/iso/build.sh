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
  --firmware-chroot false --firmware-binary false \
  --chroot-squashfs-compression-type zstd \
  --memtest none --security true --updates true --checksums sha256 --zsync false \
  --iso-application "Nebulux OS" --iso-publisher "Nebulux LLC" --iso-volume "NEBULUX_OS" \
  --image-name nebulux-os --bootappend-live-failsafe none \
  --bootappend-live "boot=live components quiet splash loglevel=3 rd.udev.log_level=3 systemd.show_status=false vt.global_cursor_default=0 username=nebulux user-fullname=Nebulux hostname=nebulux-os locales=en_US.UTF-8 keyboard-layouts=us live-config.user-default-groups=audio,cdrom,dip,floppy,video,plugdev,netdev,powerdev,scanner,bluetooth,input,render,dialout,systemd-journal persistence persistence-media=removable-usb" \
  >/dev/null

# The newer Linux kernel and firmware from Debian's backports (kernel 6.12 instead of 6.1): newer Wi-Fi chips have
# no driver in 6.1 at all. The owner's Lenovo IdeaPad (82VG) has a Realtek RTL8852BE (driver rtw89_8852be, from 6.2),
# and many 2022+ laptops use Realtek RTW89 and MediaTek MT7922 chips. Backports kernels are signed for Secure Boot.
mkdir -p config/archives
for t in chroot binary; do
  echo "deb http://deb.debian.org/debian bookworm-backports main contrib non-free-firmware" > "config/archives/backports.list.$t"
  printf 'Package: linux-image-* linux-headers-* linux-kbuild-* linux-base firmware-* amd64-microcode intel-microcode wireless-regdb\nPin: release n=bookworm-backports\nPin-Priority: 990\n' > "config/archives/backports.pref.$t"
done

# what's installed
cp "$REPO/system/iso/packages.list" config/package-lists/nebulux.list.chroot
# files placed into the system
mkdir -p config/includes.chroot
cp -a "$REPO/system/iso/root/." config/includes.chroot/
mkdir -p config/includes.chroot/opt/nebulux/www config/includes.chroot/opt/nebulux/helper config/includes.chroot/opt/nebulux/ext
cp -a "$REPO/index.html" "$REPO/css" "$REPO/js" "$REPO/img" config/includes.chroot/opt/nebulux/www/
cp -a "$REPO/system/helper/nebulux-helper.js" "$REPO/system/helper/more.js" config/includes.chroot/opt/nebulux/helper/
cp -a "$REPO/system/browser-ext/." config/includes.chroot/opt/nebulux/ext/
mkdir -p config/includes.chroot/opt/nebulux/app-ext; cp -a "$REPO/system/app-ext/." config/includes.chroot/opt/nebulux/app-ext/
echo "$VERSION" > config/includes.chroot/opt/nebulux/VERSION
# where Nebulux OS looks for its own updates (an https link to update.json; empty turns updates off). The Nebulux OS
# website serves the newest release's update.json and bundle (site/src/worker.js), so this address never has to change.
echo "${NX_UPDATE_URL:-https://nebuluxos.thebluedragonstriker.workers.dev/update.json}" > config/includes.chroot/opt/nebulux/update-url
# setup steps run inside the system while it's built
cp "$REPO/system/iso/nebulux.hook.chroot" config/hooks/normal/9000-nebulux.hook.chroot
chmod +x config/hooks/normal/9000-nebulux.hook.chroot

# the boot menu: Nebulux OS names, the Nebulux picture, and a short wait
say "Boot menu"
mkdir -p config/bootloaders
for d in isolinux syslinux_common grub-pc; do
  [ -d "/usr/share/live/build/bootloaders/$d" ] && cp -a "/usr/share/live/build/bootloaders/$d" config/bootloaders/
done
# ISOLINUX (older BIOS PCs): menu names
find config/bootloaders -type f \( -name '*.cfg' -o -name '*.in' \) -print0 | xargs -0 sed -i \
  -e 's/Live system (@FLAVOUR@ fail-safe mode)/Nebulux OS (safe mode)/g' -e 's/Live system (@FLAVOUR@)/Nebulux OS/g' \
  -e 's/Live system/Nebulux OS/g' -e 's/Debian GNU\/Linux/Nebulux OS/g'
# no menu: one entry, started right away
for d in isolinux syslinux_common; do
  [ -d "config/bootloaders/$d" ] || continue
  printf 'label live-@FLAVOUR@\n\tmenu label ^Nebulux OS\n\tmenu default\n\tlinux @LINUX@\n\tinitrd @INITRD@\n\tappend @APPEND_LIVE@\n' > "config/bootloaders/$d/live.cfg.in"
  printf 'include live.cfg\ndefault live-amd64\nprompt 0\ntimeout 0\n' > "config/bootloaders/$d/isolinux.cfg"
done
# the boot picture: a splash.png has to be there already, or live-build draws its own from splash.svg
for d in isolinux syslinux_common; do [ -d "config/bootloaders/$d" ] && cp "$REPO/system/iso/splash.png" "config/bootloaders/$d/splash.png"; cp "$REPO/system/iso/splash800x600.png" "config/bootloaders/$d/splash800x600.png"; done
# GRUB (UEFI): starts Nebulux OS at once, with no menu and no start-up beep
cat > config/bootloaders/grub-pc/config.cfg <<'GRUBCFG'
set default=0
set timeout=0
set timeout_style=hidden

loadfont $prefix/dejavu-bold-16.pf2
loadfont $prefix/dejavu-bold-14.pf2
loadfont $prefix/unicode.pf2
set gfxmode=auto
insmod all_video
insmod gfxterm
insmod png

source /boot/grub/theme.cfg

terminal_output gfxterm
GRUBCFG
printf 'source /boot/grub/config.cfg\n\n# Nebulux OS\n@LINUX_LIVE@\n' > config/bootloaders/grub-pc/grub.cfg
# GRUB menu names are written by live-build itself
for s in /usr/lib/live/build/binary_grub_cfg /usr/share/live/build/scripts/build/binary_grub_cfg; do
  [ -f "$s" ] && sed -i -e 's/Live system (autodetect) (fail-safe mode)/Nebulux OS (safe mode)/g' -e 's/Live system (autodetect)/Nebulux OS/g' \
    -e 's/"Live system (${_FLAVOUR} fail-safe mode)"/"Nebulux OS (safe mode)"/g' -e 's/"Live system (${_FLAVOUR})"/"Nebulux OS"/g' \
    -e 's/Live system, kernel/Nebulux OS, kernel/g' "$s" && echo "menu names set in $s"
done
grep -rn "timeout\|menu label" config/bootloaders/isolinux config/bootloaders/syslinux_common config/bootloaders/grub-pc/config.cfg 2>/dev/null | grep -v stdmenu | head -12 || true
# scripts made on Windows lose their "can run" mark
chmod 644 config/includes.chroot/etc/systemd/system/nebulux-screen.service config/includes.chroot/etc/nebulux/openbox.xml
chmod 755 config/includes.chroot/usr/local/bin/nebulux-key config/includes.chroot/usr/local/bin/nebulux-session config/includes.chroot/etc/X11/xinit/xinitrc config/includes.chroot/etc/skel/.xinitrc config/hooks/normal/9000-nebulux.hook.chroot

# packages downloaded by an earlier build (GitHub keeps them in .lbcache)
# only the packages themselves: Debian's package lists go stale, and old lists fail their signature check
if [ -d "$REPO/.lbcache" ]; then mkdir -p cache; cp -a "$REPO/.lbcache/." cache/ 2>/dev/null || true; rm -rf cache/indices.* cache/bootstrap cache/contents.* 2>/dev/null || true; echo "reusing $(du -sh cache 2>/dev/null | cut -f1) of downloaded packages"; fi

say "Build (this takes a while)"
lb build 2>&1 | tee "$OUT/build.log" | grep -E '^(P:|E:|W:)|error' | grep -v 'Hit:\|Get:' || true
ISO="$(ls -1 "$WORK"/*.iso 2>/dev/null | head -1)"
[ -n "$ISO" ] && [ -s "$ISO" ] || { echo "The .iso wasn't made. Last lines of the log:"; tail -60 "$OUT/build.log"; exit 1; }
# Wi-Fi and Bluetooth drivers that must be in every Nebulux OS (the build stops without them): the Realtek RTL8852BE
# (the owner's laptop), other Realtek RTW89 chips, MediaTek MT7921/MT7922, and Intel AX200/AX210 and newer.
say "Wi-Fi drivers"
KV="$(ls -1 "$WORK/chroot/lib/modules" | sort -V | tail -1)"; echo "kernel $KV"
miss=""
# must be there: the owner's RTL8852BE (driver and firmware) and the common driver families
for m in realtek/rtw89/rtw89_8852be realtek/rtw89/rtw89_8852ae realtek/rtw89/rtw89_8852ce mediatek/mt76/mt7921/mt7921e intel/iwlwifi/iwlwifi; do
  ls "$WORK/chroot/lib/modules/$KV/kernel/drivers/net/wireless/$m".ko* >/dev/null 2>&1 && echo "ok  $m" || miss="$miss $m"
done
for f in rtw89/rtw8852b_fw rtl_bt/rtl8852bu_fw; do
  ls "$WORK/chroot/lib/firmware/$f"* >/dev/null 2>&1 && echo "ok  firmware $f" || miss="$miss firmware:$f"
done
# good to have (reported, not required)
for f in mediatek/WIFI_RAM_CODE_MT7922_1 mediatek/WIFI_RAM_CODE_MT7961_1 iwlwifi-ty-a0-gf-a0; do
  ls "$WORK/chroot/lib/firmware/$f"* >/dev/null 2>&1 && echo "ok  firmware $f" || echo "--  firmware $f not included"
done
[ -z "$miss" ] || { echo "Missing Wi-Fi drivers or firmware:$miss"; exit 1; }
mv "$ISO" "$OUT/nebulux-os.iso"
# keep the downloaded packages for the next build
if [ -d "$WORK/cache" ]; then rm -rf "$REPO/.lbcache"; mkdir -p "$REPO/.lbcache"; cp -a "$WORK/cache/." "$REPO/.lbcache/" 2>/dev/null || true; rm -rf "$REPO"/.lbcache/indices.* "$REPO/.lbcache/bootstrap" 2>/dev/null || true; fi
( cd "$OUT" && sha256sum nebulux-os.iso > nebulux-os.iso.sha256 )
ls -la "$OUT"
say "Done: $OUT/nebulux-os.iso"
