#!/bin/bash
# Boots the Nebulux OS .iso in a virtual computer (QEMU), once the old way (BIOS) and once the new way (UEFI), and
# takes screenshots: the boot, the lock screen, making an account with the keyboard, the desktop, Google and Settings.
# Fails if the virtual computer never reaches the Nebulux OS screens.
#   bash system/iso/boot-test.sh out/nebulux-os.iso out/screens
set -uo pipefail
ISO="${1:?the .iso}"; SHOTS="${2:-out/screens}"; mkdir -p "$SHOTS"
ACCEL="-accel tcg"; [ -w /dev/kvm ] && ACCEL="-accel kvm -cpu host"
echo "Acceleration: $ACCEL"

shot() { # name
  echo "screendump /tmp/nx.ppm" | socat - UNIX-CONNECT:/tmp/qmon >/dev/null 2>&1; sleep 1
  python3 "$(dirname "$0")/ppm2png.py" /tmp/nx.ppm "$SHOTS/$MODE-$1.png" || echo "no screenshot for $1"
}
keys() { for k in "$@"; do echo "sendkey $k" | socat - UNIX-CONNECT:/tmp/qmon >/dev/null 2>&1; sleep 0.15; done; }
typeword() { local s="$1" i c; for ((i = 0; i < ${#s}; i++)); do c="${s:i:1}"; case "$c" in [A-Z]) keys "shift-${c,,}";; " ") keys spc;; *) keys "$c";; esac; done; }

FAILS=0
boot() { # BIOS or UEFI
  MODE="$1"; rm -f /tmp/qmon
  local fw=""; [ "$MODE" = uefi ] && fw="-drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd"
  qemu-system-x86_64 $ACCEL -m 4096 -smp 2 $fw -cdrom "$ISO" -boot d -vga std -display none \
    -device qemu-xhci -device usb-tablet -nic user,model=virtio-net-pci \
    -monitor unix:/tmp/qmon,server,nowait -serial file:"$SHOTS/$MODE-serial.log" &
  QPID=$!; T0=$(date +%s)
  sleep 8; shot 1-bootmenu
  sleep 30; shot 2-starting
  # wait for the Nebulux OS screens (the lock screen is mostly purple)
  local up=0
  for _ in $(seq 1 40); do sleep 5; shot now; python3 "$(dirname "$0")/ppm2png.py" --check /tmp/nx.ppm && { up=1; break; }; done
  rm -f "$SHOTS/$MODE-now.png"
  if [ "$up" != 1 ]; then echo "FAIL ($MODE): Nebulux OS didn't show up"; shot 9-stuck; FAILS=$((FAILS + 1)); kill $QPID; wait $QPID 2>/dev/null; return; fi
  echo "ok   ($MODE): Nebulux OS is on screen, $(( $(date +%s) - T0 )) seconds after turning on"
  sleep 4; shot 3-lock
  keys spc; sleep 2
  typeword "Ada"; keys tab; typeword "nebula1"; keys tab; typeword "nebula1"; keys ret; sleep 6; shot 4-desktop
  if python3 "$(dirname "$0")/ppm2png.py" --full /tmp/nx.ppm; then echo "ok   ($MODE): Nebulux OS fills the whole screen"; else echo "FAIL ($MODE): Nebulux OS doesn't fill the screen"; FAILS=$((FAILS + 1)); fi
  if grep -q "NEBULUX-DIAG ext=1" "$SHOTS/$MODE-serial.log"; then echo "ok   ($MODE): the web-windows extension is running"; else echo "FAIL ($MODE): the web-windows extension isn't running ($(grep -a NEBULUX-DIAG "$SHOTS/$MODE-serial.log" | tail -1))"; FAILS=$((FAILS + 1)); fi
  keys meta_l; sleep 2; typeword "google"; sleep 1; keys ret; sleep 15; shot 5-google
  keys meta_l; sleep 2; typeword "settings"; sleep 1; keys ret; sleep 6; shot 6-settings
  keys meta_l; sleep 2; typeword "file explorer"; sleep 1; keys ret; sleep 5; shot 7-files
  echo "system_powerdown" | socat - UNIX-CONNECT:/tmp/qmon >/dev/null 2>&1
  for _ in $(seq 1 30); do kill -0 $QPID 2>/dev/null || break; sleep 2; done
  kill $QPID 2>/dev/null; wait $QPID 2>/dev/null
}
boot bios
boot uefi
ls -la "$SHOTS"
[ "$FAILS" = 0 ] && echo "boot test passed" || { echo "boot test: $FAILS failed"; exit 1; }
