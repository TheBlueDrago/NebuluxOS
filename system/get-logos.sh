#!/bin/bash
# Downloads the logo of every app in the Nebulux Store that isn't Nebulux OS's own into img/logos/<app>.png,
# so the OS has them at once and offline. Real apps use their icon from Flathub; websites use their own site icon.
# A few apps share a website, so they get their own source here. Run from the repo: bash system/get-logos.sh
set -u
cd "$(dirname "$0")/.."
mkdir -p img/logos
FAV="https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://"
declare -A SRC=(
  [word]="${FAV}word.cloud.microsoft" [excel]="${FAV}excel.office.com" [powerpoint]="${FAV}powerpoint.cloud.microsoft"
  [gdocs]="https://www.gstatic.com/images/branding/product/2x/docs_2020q4_96dp.png"
  [gsheets]="https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_96dp.png"
  [gslides]="https://www.gstatic.com/images/branding/product/2x/slides_2020q4_96dp.png"
  [classroom]="https://www.gstatic.com/images/branding/product/2x/classroom_96dp.png"
  [gmaps]="${FAV}maps.google.com" [mcclassic]="${FAV}www.minecraft.net"
  [ebay]="https://www.ebay.com/apple-touch-icon.png" [twitch]="https://www.twitch.tv/apple-touch-icon.png" [tiktok]="https://www.tiktok.com/apple-touch-icon.png"
)
node -e '
  global.NX = { apps: {} }; global.window = global; global.document = { addEventListener() {} };
  require("./js/app-webapps.js");
  for (const [id, a] of Object.entries(NX.apps)) {
    if (!String(a.icon).includes("|")) continue;
    const src = a.native ? "f:" + a.native.flatpak : "w:" + new URL(a.url).hostname;
    console.log(id + " " + src);
  }' | while read -r id src; do
  url="${SRC[$id]:-}"
  if [ -z "$url" ]; then case "$src" in f:*) url="https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/${src#f:}.png";; *) url="$FAV${src#w:}";; esac; fi
  code=$(curl -sL -A "Mozilla/5.0" -o "img/logos/$id.png" -w "%{http_code}" "$url")
  [ "$code" = 200 ] && echo "ok   $id" || echo "FAIL $id ($code) $url"
done
