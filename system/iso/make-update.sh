#!/bin/bash
# Makes the self-update for a release: nebulux-update.tar.gz (the Nebulux OS part: screens, apps, helper, add-on)
# and update.json, the small file every Nebulux OS checks (version, what's new, the bundle's link and fingerprint).
# Usage: bash system/iso/make-update.sh VERSION BUNDLE_URL OUTDIR
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
V="$1"; URL="$2"; OUT="$3"
T="$(mktemp -d)"
mkdir -p "$T/www" "$T/helper" "$T/ext" "$T/wm" "$OUT"
cp -a "$REPO/index.html" "$REPO/css" "$REPO/js" "$REPO/img" "$T/www/"
cp -a "$REPO/system/helper/nebulux-helper.js" "$REPO/system/helper/more.js" "$T/helper/"
cp -a "$REPO/system/browser-ext/." "$T/ext/"
mkdir -p "$T/app-ext"; cp -a "$REPO/system/app-ext/." "$T/app-ext/"
# the window-manager setup (keyboard shortcuts over every app); the helper starts it from here on older USBs
mkdir -p "$T/wm"; cp -a "$REPO/system/iso/root/etc/nebulux/openbox.xml" "$REPO/system/iso/root/usr/local/bin/nebulux-key" "$T/wm/"
echo "$V" > "$T/VERSION"
tar -czf "$OUT/nebulux-update.tar.gz" -C "$T" --owner=0 --group=0 .
rm -rf "$T"
SUM=$(sha256sum "$OUT/nebulux-update.tar.gz" | cut -d' ' -f1); SIZE=$(stat -c %s "$OUT/nebulux-update.tar.gz")
node -e '
  global.NX = {}; require(process.argv[1]);
  const [v, url, sum, size] = process.argv.slice(2);
  if (NX.version !== v) { console.error("js/whatsnew.js says " + NX.version + " but this release is " + v); process.exit(1); }
  process.stdout.write(JSON.stringify({ version: v, notes: NX.whatsNew.map((x) => x[0]), bundle: url, sha256: sum, size: +size, needsIso: process.env.NX_NEEDS_ISO === "1" }, null, 1));
' "$REPO/js/whatsnew.js" "$V" "$URL" "$SUM" "$SIZE" > "$OUT/update.json"
cat "$OUT/update.json"; echo
