# Nebulux OS: the first screen starts Nebulux OS full screen, and starts it again if it ever closes.
if [ -z "$DISPLAY" ] && [ "$(tty)" = /dev/tty1 ]; then
  fails=0
  while true; do
    start=$(date +%s)
    startx /usr/local/bin/nebulux-session -- -keeptty -nolisten tcp >"$HOME/.nebulux-x.log" 2>&1
    if [ $(( $(date +%s) - start )) -lt 15 ]; then fails=$((fails + 1)); else fails=0; fi
    if [ "$fails" -ge 4 ]; then
      clear; echo; echo "  Nebulux OS couldn't start the screen on this computer."
      echo "  Details are in $HOME/.nebulux-x.log"; echo
      echo "  Press Enter to try again, or hold the power button to turn the computer off."; read -r _; fails=0
    fi
    sleep 1
  done
fi
