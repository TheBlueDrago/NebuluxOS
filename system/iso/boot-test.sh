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
# a real mouse click at a spot on the 1280x800 screen (QEMU's tablet takes 0..32767 across the screen):
# move there and press in one go, a short pause, then let go (like a finger on a real mouse)
qmp() { printf '%s\n' '{"execute":"qmp_capabilities"}' "$1" | socat -t 1 - UNIX-CONNECT:/tmp/qmp >/dev/null 2>&1; }
click() {
  local x=$(( $1 * 32767 / 1280 )) y=$(( $2 * 32767 / 800 ))
  qmp "{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$y}}]}}"
  sleep 0.3
  qmp "{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$x}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$y}},{\"type\":\"btn\",\"data\":{\"down\":true,\"button\":\"left\"}}]}}"
  sleep 0.15
  qmp '{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}}]}}'
  sleep 0.4
}
keys() { for k in "$@"; do echo "sendkey $k" | socat - UNIX-CONNECT:/tmp/qmon >/dev/null 2>&1; sleep 0.15; done; }
typeword() { local s="$1" i c; for ((i = 0; i < ${#s}; i++)); do c="${s:i:1}"; case "$c" in [A-Z]) keys "shift-${c,,}";; " ") keys spc;; *) keys "$c";; esac; done; }

FAILS=0
boot() { # BIOS or UEFI
  MODE="$1"; rm -f /tmp/qmon /tmp/qmp
  local fw=""; [ "$MODE" = uefi ] && fw="-drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd"
  qemu-system-x86_64 $ACCEL -m 4096 -smp 2 $fw -cdrom "$ISO" -boot d -vga std -display none \
    -device qemu-xhci -device usb-tablet -nic user,model=virtio-net-pci \
    -monitor unix:/tmp/qmon,server,nowait -qmp unix:/tmp/qmp,server,nowait -serial file:"$SHOTS/$MODE-serial.log" &
  QPID=$!; T0=$(date +%s)
  sleep 8; shot 1-bootmenu
  sleep 30; shot 2-starting
  # wait for the Nebulux OS screens (the lock screen is mostly purple)
  local up=0
  for _ in $(seq 1 40); do sleep 5; shot now; python3 "$(dirname "$0")/ppm2png.py" --check /tmp/nx.ppm && { up=1; break; }; done
  rm -f "$SHOTS/$MODE-now.png"
  if [ "$up" != 1 ]; then echo "FAIL ($MODE): Nebulux OS didn't show up"; shot 9-stuck; FAILS=$((FAILS + 1)); kill $QPID; wait $QPID 2>/dev/null; return; fi
  echo "ok   ($MODE): Nebulux OS is on screen, $(( $(date +%s) - T0 )) seconds after turning on"
  sleep 3; grep -aE "NEBULUX-(BOOT|HW)" "$SHOTS/$MODE-serial.log" | head -20
  sleep 4; shot 3-lock
  # first-time setup: name, password, region, keyboard, network, Google sign-in, privacy, look (Enter takes each step)
  typeword "Ada"; keys ret; sleep 2
  typeword "nebula1"; keys tab; typeword "nebula1"; keys ret; sleep 2; shot 3b-region
  keys ret; sleep 2; keys ret; sleep 2; keys ret; sleep 3; shot 3a-google; keys ret; sleep 2; shot 3c-privacy
  keys ret; sleep 2; keys ret; sleep 12; shot 4-desktop
  if python3 "$(dirname "$0")/ppm2png.py" --full /tmp/nx.ppm; then echo "ok   ($MODE): Nebulux OS fills the whole screen"; else echo "FAIL ($MODE): Nebulux OS doesn't fill the screen"; FAILS=$((FAILS + 1)); fi
  if grep -q "NEBULUX-DIAG ext=1" "$SHOTS/$MODE-serial.log"; then echo "ok   ($MODE): the web-windows extension is running"; else echo "FAIL ($MODE): the web-windows extension isn't running ($(grep -a NEBULUX-DIAG "$SHOTS/$MODE-serial.log" | tail -1))"; FAILS=$((FAILS + 1)); fi
  # the network troubleshooter may run its fixes (Wi-Fi switch, driver restart) without a password
  if grep -aq "NEBULUX-HW netfix: allowed" "$SHOTS/$MODE-serial.log"; then echo "ok   ($MODE): the Wi-Fi fixes are allowed"; else echo "FAIL ($MODE): the Wi-Fi fixes aren't allowed ($(grep -a "NEBULUX-HW netfix" "$SHOTS/$MODE-serial.log" | tail -1))"; FAILS=$((FAILS + 1)); fi
  # the mouse: one click on the Settings icon on the desktop opens Settings
  click 52 145; sleep 6; shot 4b-click
  click 430 776; sleep 2; shot 4c-start-click; keys esc; sleep 1
  if grep -aq "NEBULUX-DIAG open=settings" "$SHOTS/$MODE-serial.log"; then echo "ok   ($MODE): a mouse click opens Settings from the desktop"; else echo "FAIL ($MODE): a mouse click on the desktop didn't open Settings"; FAILS=$((FAILS + 1)); grep -a "NEBULUX-X" "$SHOTS/$MODE-serial.log" | head -45; fi
  # screen recording (a note, not a failure): the helper films 2 seconds of the screen in the virtual computer
  RS=$(grep -ao "NEBULUX-DIAG screenrec=[0-9]*" "$SHOTS/$MODE-serial.log" | tail -1 | cut -d= -f2)
  if [ "${RS:-0}" -gt 1000 ]; then echo "ok   ($MODE): screen recording works ($RS bytes in 2 seconds)"; else echo "note ($MODE): screen recording didn't make a file (${RS:-no answer})"; fi
  # Narrator's voices (speech-dispatcher and eSpeak NG): the page reports how many voices it can use
  VO=$(grep -ao "NEBULUX-DIAG ext=[0-9].* voices=-\?[0-9]*" "$SHOTS/$MODE-serial.log" | tail -1 | sed 's/.*voices=//')
  if [ "${VO:-0}" -gt 0 ] 2>/dev/null; then echo "ok   ($MODE): Narrator has $VO voices"; else echo "FAIL ($MODE): Narrator has no voice (${VO:-no answer})"; FAILS=$((FAILS + 1)); fi
  # mono audio (a note: the virtual computer has no sound card, only the sound system's stand-in)
  MO=$(grep -ao "NEBULUX-DIAG mono=[^ ]*" "$SHOTS/$MODE-serial.log" | tail -1 | cut -d= -f2)
  if [ "$MO" = ok ]; then echo "ok   ($MODE): mono audio turns on and off"; else echo "note ($MODE): mono audio didn't switch (${MO:-no answer})"; fi
  keys meta_l; sleep 2; typeword "google"; sleep 1; keys ret; sleep 25; shot 5-google
  # the mouse on the real browser: click into Google's search box and type
  click 640 304; sleep 1; typeword "nebulux"; sleep 3; shot 5b-browser-click
  # apps open as apps (their own window, no web address): YouTube and Nebulux Arcade, each closed with Alt + F4
  keys meta_l; sleep 2; typeword "youtube"; sleep 1; keys ret; sleep 25; shot 5c-youtube
  keys meta_l; sleep 2; typeword "nebulux arcade"; sleep 1; keys ret; sleep 25; shot 5d-arcade
  keys meta_l; sleep 2; typeword "settings"; sleep 1; keys ret; sleep 6; shot 6-settings
  keys meta_l; sleep 2; typeword "file explorer"; sleep 1; keys ret; sleep 5; shot 7-files
  # Ctrl + W closes the window in front (File Explorer, then Settings) and never the whole Nebulux OS screen:
  # if the screen had closed, the session would start it again and the page would report itself (ext=) once more
  E0=$(grep -ac "NEBULUX-DIAG ext=" "$SHOTS/$MODE-serial.log"); O0=$(grep -ac "NEBULUX-DIAG open=settings" "$SHOTS/$MODE-serial.log")
  keys ctrl-w; sleep 2; keys ctrl-w; sleep 2; keys ctrl-w; sleep 2; keys ctrl-t; sleep 2; shot 8-ctrlw
  sleep 12; click 52 145; sleep 6; shot 8b-after-ctrlw
  E1=$(grep -ac "NEBULUX-DIAG ext=" "$SHOTS/$MODE-serial.log"); O1=$(grep -ac "NEBULUX-DIAG open=settings" "$SHOTS/$MODE-serial.log")
  if [ "$E1" = "$E0" ] && [ "$O1" -gt "$O0" ]; then echo "ok   ($MODE): Ctrl + W closes windows, not Nebulux OS"; else echo "FAIL ($MODE): Ctrl + W closed the Nebulux OS screen (page reports $E0 then $E1, Settings opened $O0 then $O1)"; FAILS=$((FAILS + 1)); fi
  echo "system_powerdown" | socat - UNIX-CONNECT:/tmp/qmon >/dev/null 2>&1
  for _ in $(seq 1 30); do kill -0 $QPID 2>/dev/null || break; sleep 2; done
  kill $QPID 2>/dev/null; wait $QPID 2>/dev/null
}
# UEFI by default (nearly every computer from the last 10 years); NX_BOOTS="bios uefi" tests the old BIOS start-up too
for m in ${NX_BOOTS:-uefi}; do boot "$m"; done
ls -la "$SHOTS"
[ "$FAILS" = 0 ] && echo "boot test passed" || { echo "boot test: $FAILS failed"; exit 1; }
