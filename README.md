# Nebulux OS

Nebulux OS is a real operating system that starts from a USB stick. It looks and works like Windows 11, with Nebulux designs. It has:

- a lock screen and sign-in;
- the desktop with Start and the taskbar;
- Settings, Google and the Nebulux Store.

It runs on the computer itself, not inside Windows. It never touches the computer's own drive: take the USB out and restart, and the computer starts the way it always did.

---

## Part 1: Download Nebulux OS

1. Open this repo on GitHub: **TheBlueDrago/NebuluxOS**. The repo is private, so you have to be signed in to GitHub.
2. On the right side, click **Releases**, then the newest release, **Nebulux OS 4.2**.
3. Under **Assets**, click **`Nebulux-OS-4.2.iso`** to download it. It's about 1.5 GB.
4. *(Optional)* To check that the download isn't damaged, open PowerShell in your Downloads folder and run
   `Get-FileHash .\Nebulux-OS-4.2.iso`. The number it shows should match the `SHA-256` on the release page.

## Part 2: Put it on your USB

> **Writing Nebulux OS to a USB erases everything on that USB.** Copy your files off it first.
> The USB needs to be **4 GB or bigger**. Yours (SanDisk Cruzer Spark, 32 GB) is fine.

1. **Back up the USB.** Plug it in, open it in File Explorer, and copy everything you want to keep to a folder on your computer.
2. **Get Rufus.** It's a free, well-known USB tool. Download it only from its official site, **rufus.ie** (the "Rufus Portable" one is fine).
3. **Open Rufus** and choose these settings:
   - **Device:** your USB stick. Check the name and size, because whatever you pick here gets erased.
   - **Boot selection:** click **SELECT** and pick `Nebulux-OS-4.2.iso`.
   - **Persistent partition size:** slide it to about **4 GB** or more. This makes Nebulux OS **remember your accounts, settings, Wi-Fi passwords and notes** between restarts. Without it, Nebulux OS starts fresh every time.
   - **Partition scheme:** **GPT** for most computers from 2013 or later. Pick **MBR** for older ones.
   - Leave everything else as it is.
4. Click **START**.
   - If it asks about **ISOHybrid**, choose **"Write in ISO Image mode (Recommended)"**.
   - If it asks to download extra files, say **Yes**.
   - Confirm the erase warning.
5. When the bar says **READY**, close Rufus and safely remove the USB.

*(Also works:* **balenaEtcher** from etcher.balena.io: Flash from file → pick the USB → Flash. Etcher has no persistence option, so with it Nebulux OS starts fresh each time.)

## Part 3: Start a computer from the USB

1. Plug the USB into the computer and **turn it on, or restart it**.
2. Right away, tap the **boot menu key** over and over until a list of drives shows up:

   | Computer maker | Boot menu key |
   |---|---|
   | HP | **F9** (or Esc, then F9) |
   | Dell | **F12** |
   | Lenovo | **F12** (or the small Novo button) |
   | Acer, ASUS laptops | **F12** or **Esc** |
   | ASUS desktops, MSI | **F8** or **F11** |
   | Microsoft Surface | hold **Volume down** while pressing Power |

   **From Windows:** click Start → Power, **hold Shift** and click **Restart**. Then choose **Use a device** → your USB.
3. Pick your USB from the list. It may say "UEFI: SanDisk".
4. Nebulux OS starts by itself: no menu to pick from and no text login. You see the Nebulux logo with a spinner, then the sign-in screen with the password box ready.
5. The first time, **first-time setup** walks you through it, like a new Windows 11 PC:
   1. Make your account: your name and a password.
   2. Your country or region.
   3. Your keyboard layout.
   4. A Wi-Fi network (if the computer isn't online yet).
   5. **Sign in with Google** (optional), so Gmail, YouTube and Drive are ready in the web browser.
   6. Privacy choices.
   7. Your look: dark or light, a color and a background.

   Accounts you add later (Add account on the sign-in screen) get the same questions.

   Then it says hi while it gets ready, and you're on the desktop. Next time, sign in with your name and password.

**To go back to Windows:** use Start → Power → **Shut down**, take the USB out, and turn the computer on. Windows starts like always.

### Trying it in QEMU instead of a real computer

QEMU's virtual computer has **no Wi-Fi, Bluetooth or wireless-display hardware**, so those show as missing there. Its network works through a pretend cable instead. On a real computer they work.

QEMU on Windows is very slow unless it uses Windows' own speed-up. Do this once:
1. Press Start, type **Turn Windows features on or off**, and tick **Windows Hypervisor Platform**.
2. Restart the PC.

Then start Nebulux OS like this (all on one line):

```powershell
& "C:\Program Files\qemu\qemu-system-x86_64.exe" -accel whpx,kernel-irqchip=off -m 4096 -smp 4 -cdrom "$env:USERPROFILE\Downloads\Nebulux-OS-4.2.iso" -boot d -vga std -device qemu-xhci -device usb-tablet -nic user,model=virtio-net-pci
```

### If it doesn't start

- **It goes straight to Windows.** You didn't hit the boot menu key in time: restart and tap it as soon as the screen turns on. Or use the Shift + Restart way above.
- **"Secure Boot violation" or a red warning.** Nebulux OS supports Secure Boot, but some computers still refuse. Turn **Secure Boot** off in the computer's setup screen: usually **F2**, **Del** or **F10** at power-on, under Boot or Security. You can turn it back on afterwards.
- **Only a blinking line or a black screen for more than 2 minutes.** Restart once more. If it still happens, note the computer's brand and model, which helps find the cause.
- **Mac computers.** Hold **Option (⌥)** at power-on and choose "EFI Boot". Macs with Apple chips (M1 and newer) can't start other systems from USB.

---

## What's in it

- **New in 4.2:** record your screen from Snipping Tool; Quick Search finds words inside your text files; reopen your apps when you sign in; a lock screen slideshow; move a window to another desktop; drag Start's pinned apps into your own order; Coming up in Calendar; a battery chart and a 7-day Screen time chart; a temperature line in Weather; playback speed in Media Player; Delete in Photos; Ctrl + Z to undo a delete, and Copy as path, in File Explorer; Storage Sense; accent color on title bars and the taskbar; Notepad asks the file name and F5 adds the date and time; Copy on Settings > About. Fixes: typing in Start works right after using an app, and a web search opens even when Google is already open.
- **New in 4.1:** the update window has Update now, Remind me later and Never, and an update installs by itself the next time the computer starts (or overnight). Apps open like apps, with no web address, and their links stay inside the app. Setup's Sign in with Google brings you back by itself, and setup is livelier. Also: repeating events and reminders, holidays in the calendar, quiet hours, Quick Search answers for money, time in other cities and word meanings, All apps by category, Nebulux + Z, Calculator Dates, a Photos widget, world clocks on the desktop, clipboard search, Media Player keys, and the lock screen shows your next event and waiting notifications.
- **New in 4.0:**
  - **A whole new look:** glass that takes color from your background, a floating taskbar, twinkling stars over the wallpaper, live window pictures in Task View and Alt + Tab, notifications and the calendar as floating cards, colored Settings icons, folder icons, and a new start-up screen.
  - **Themes** (also the last step of setup), **corners** (square, round, extra round), **glass** (clear, frosted, solid), colored-dot **window buttons**, an **Auto** accent color, a **lock screen picture**, **pointer color**, a sign-in **chime**, and seven new backgrounds.
  - A new **update window** (Update now with a live progress bar), the **snap bar** (drag a window to the top), **Snap Assist**, corner snapping, **Stacks** on the desktop, **screen savers**, **Ctrl + Alt + Delete**, **Peek** and **Shake**, **jump lists**, **Edit quick settings**, **Focus** in the calendar flyout, taskbar app names and items, icon sizes, a background for each desktop, and windows that grow from where you click.
  - File Explorer **Gallery** and **Preview pane**, **Back up** to a USB drive, a **Weather** app with an animated sky, music controls on the lock screen, notification icons, Night light strength, and Choose a fit for your own picture.
  - **Quick Search** suggestions before you type, **Settings search** that finds settings by name, your next event and reminders on the **lock screen**, **Update and restart** in Start, a **Text tool** in Paint, taskbar tooltips, Sort by name on the desktop, and backgrounds that fade from one to the next.
  - Snap layouts in **thirds** on wide screens, an **analog clock**, dancing bars in **Media Player**, a tidier **Paint**, **Reminders** with a due count on the taskbar, and **Task Manager** graphs that glow.
  - **Quick Search** (Nebulux + Space): apps, settings, files, Store apps, sums, unit conversions and the weather in one box.
  - **Stage**, **desktop widgets**, **hot corners**, the **App Grid** (Nebulux + G), an auto-hiding taskbar and icons that grow under the pointer.
  - **Calendar**, **Peek** (Space on a file), **color tags** in File Explorer, **Versions** in Notepad, **favorites** in Photos, **picture in picture**, and **Now playing** in quick settings.
  - Screenshots of part of the screen (Nebulux + Shift + S), **Magnifier** (Nebulux + Plus), **Increase contrast**, **Screen time**, and a background that follows the day.
- **Sign-in:** a lock screen with the clock.
  - Accounts with passwords, more than one account, and a 30-second lock after 5 wrong tries.
  - Only a salted, scrambled form of each password is kept.
  - There's no password reset: a forgotten password means making a new account.
- **Home:**
  - the desktop with icons, and a centered taskbar with Start (search, Pinned, Recommended, power);
  - quick settings, a calendar, notifications and right-click menus.
  - Windows drag, snap to the top or sides, resize from any edge, minimize, maximize and close.
- **Settings:**
  - **Wi-Fi:** see the networks near you, connect with a password, and disconnect. A network cable works on its own.
  - **Bluetooth:** Add device finds headphones, mice, keyboards and more; Pair connects them, and Remove forgets them.
  - **Real controls:** brightness, volume, and night light.
  - **Personalization:** wallpapers, dark or light, accent color and taskbar position.
  - **Accounts, Apps, Time & language,** and **About**, which shows the computer's real processor, memory and kernel.
- **File Explorer:**
  - Your folders: Desktop, Documents, Downloads, Pictures, Music and Videos.
  - The Recycle Bin, and plugged-in **USB drives**, which open by themselves; Eject one before you take it out.
  - New folder, New text file, Cut, Copy, Paste, Rename, Delete, Search, and Icons or Details view.
  - Double-click opens a file in the app that fits it. Downloads from Google land in Downloads.
  - The computer's own drive (where Windows is) is never shown or touched.
- **Screens and TV** (Settings > System):
  - **With an HDMI cable:** plug a TV or monitor in, and it shows the same picture by itself. Choose **Duplicate**, **Second screen only** or **This screen only**.
  - **Sound on the TV:** under "Play sound on", pick the TV's speakers.
  - **Wireless display:** cast to a TV that supports Miracast ("screen mirroring" on many Samsung, LG and Roku TVs and Fire TV sticks). Press **Connect** and pick the TV. It needs a computer whose Wi-Fi supports Miracast, and not every Wi-Fi card does.
- **Photos:** see your pictures and screenshots, with zoom and rotate.
- **Media Player:** plays music and videos (MP4, WebM, MP3, WAV, OGG, M4A, FLAC).
- **Snipping Tool:** take a screenshot, with an optional timer. You can also press **Nebulux + Shift + S** or **Print Screen** any time. Screenshots go in Pictures > Screenshots.
- **Notepad** opens and saves real text files (Open, Save to Documents). **Paint** saves into Pictures.
- **Windows 11 look and feel:**
  - The taskbar has Widgets on the left (the weather where you are), Start, a Search box and Task View.
  - **Task View** (the button, or Nebulux + Tab) shows all your open windows.
  - **Snap layouts:** hover over a window's maximize button and pick where it goes: halves, two-thirds, or quarters.
  - **Start** has Pinned, **All apps** (A to Z) and **Recommended**, with the files you opened recently.
  - **Widgets** (Nebulux + W): the weather for your city with the next three days, the date, and recent files. The weather comes from Open-Meteo, a free service.
  - **The desktop** shows the files in your Desktop folder. Right-click it for New folder and New text document.
- **Updates by themselves (3.1):** once you're on Nebulux OS, you never download a new .iso for an update.
  - After you sign in (and every few hours) it checks for an update, reminds you, then asks: **Later** installs it tonight (between 2 and 4 in the morning, with the computer on), **Remind me** asks again in 30 minutes, **Never** skips it.
  - **Settings > Nebulux Update** shows the version, **Check for updates** and **Update now**, even for a skipped update.
  - Only the Nebulux OS part updates (its screens, apps, helper and browser add-on). It's checked against its fingerprint before it's used, and if an update ever doesn't start, Nebulux OS goes back to the version on the USB.
  - On a USB that doesn't save changes, an update lasts until the computer restarts.
- **What's new:** after an update, everyone sees what was added the first time they sign in.
- **Real apps in the Nebulux Store (3.1):** Steam, Minecraft, Spotify, Discord, Zoom, Slack, Telegram, VLC, OBS Studio, GIMP, Krita, Blender, LibreOffice, Firefox, Google Chrome, Visual Studio Code, Signal and Audacity install as real apps (from Flathub) and open in their own windows. About 70 more open as web apps. Real apps need internet and a USB that saves changes.
- **Window buttons:** app windows and real apps have minimize, maximize/restore and close, with a Nebulux title bar.
- **Pin apps your way:** press the Nebulux key (or use the taskbar Search box), search for an app, and the details on the right have **Pin to taskbar**, **Show on desktop** or **Hide from desktop**, and **Uninstall**. Or right-click an app on the desktop. Apps stay on the desktop unless you hide them.
- **Guest start:** on a USB that doesn't save changes (Rufus persistent partition 0), Nebulux OS offers **Start without setting up**, as Guest.
- **Battery:** the bar inside the battery icon goes down with the charge: green while charging, orange at 20%, red at 10%. **Battery saver** (quick settings, or Settings > System > Power & battery) turns it yellow and turns off effects and animations; it turns on by itself at 20%.
- **Mouse speed:** Settings > Bluetooth & devices > Mouse, from Slower to Faster. The Store's rows have arrow buttons, so you don't need to aim at a thin scroll bar.
- **The Nebulux logo** is the Nebulux nebula, on the Start button, the start-up screen and the sign-in screen.
- **Keyboard shortcuts** with the **Nebulux key**, which is the key with the Windows logo on your keyboard (they work over every window):

  | Keys | What it does |
  |---|---|
  | Nebulux (the key with the Windows logo) | Open Start |
  | Alt + Tab | Switch between open windows |
  | Nebulux + D | Show the desktop (press again to bring the windows back) |
  | Nebulux + Left / Right | Snap the window to half the screen |
  | Nebulux + Up / Down | Maximize, or restore and minimize |
  | Nebulux + L | Lock (your apps stay open) |
  | Nebulux + Tab | Task View |
  | Nebulux + W | Widgets |
  | Nebulux + E | File Explorer |
  | Nebulux + Shift + S, or Print Screen | Screenshot |
  | Ctrl + Shift + Esc | Task Manager |
- **Task Manager:** your open apps, with End task, and live graphs of how busy the processor is and how much memory is in use.
- **Notifications:** click the clock to see recent notifications, with Clear all. **Do not disturb** in quick settings keeps them quiet.
- **Transparency effects** (Settings > Personalization): the frosted-glass look. It's off by default on the USB system, which draws without the graphics chip's help, because the solid look is faster there. Turn it on if your computer is quick.
- **Start-up:** the Nebulux OS logo with a spinner, then straight to the lock screen.
- **A real web browser:** Google, YouTube, Nebulux AI, the Arcade and web searches open in a real browser window, with tabs, Google sign-in, Gmail and YouTube that fully work. It sits above the desktop and stops just above the taskbar. Click Google on the taskbar to hide or show it; Start and the other apps tuck it away by themselves.
- **YouTube** is on the taskbar and the desktop.
- **The Nebulux Store has about 70 well-known apps**, as their web versions (Windows apps can't run here, but these have full web apps):
  - Watch: Netflix, Disney+, Prime Video, Hulu, Max, Twitch, Crunchyroll and Tubi.
  - Listen: Spotify, YouTube Music, SoundCloud and Apple Music.
  - Chat and share: WhatsApp, Instagram, TikTok, Discord, Facebook, Messenger, X, Reddit, Pinterest, Snapchat, Telegram and LinkedIn.
  - Work and school: Microsoft 365, Word, Excel, PowerPoint, Outlook, OneDrive, Teams, Gmail, Google Docs, Sheets, Slides, Drive, Calendar and Meet, plus Zoom, Slack, Notion and Trello.
  - AI: ChatGPT, Microsoft Copilot, Gemini and Claude.
  - Play: Xbox Cloud Gaming, GeForce NOW, Chess.com, Minecraft Classic, Poki and Wordle.
  - Create, shop, learn and tools: Canva, Figma, Photopea, CapCut, Amazon, eBay, Walmart, Etsy, Duolingo, Khan Academy, Wikipedia, Google Classroom, Maps, Translate, Photos and Speedtest.

  **Get** puts an app in Start and on the desktop, and on the USB system it opens in its own app window. The tiles use each app's colors and initials.
- **Settings like Windows 11:** Home (your account, the PC, Wi-Fi and Bluetooth at a glance, recommended settings), System (with About inside), Bluetooth & devices, Network & internet, Personalization, Apps, Accounts, Time & language, Accessibility, Privacy & security and Nebulux Update.
- **Start search** finds apps, settings and your files.
- **Quick settings like Windows 11:** the arrows on Wi-Fi and Bluetooth open their lists right in the panel (connect to a network with its password, see your devices). **Cast** shows Nebulux OS on a TV.
- **Mouse:** a calmer pointer speed by default, tap-to-click on touchpads, and Settings > Bluetooth & devices > Mouse pointer speed.
- **Desktop icons** open with a single click.
- **Google** (inside a plain browser tab, where there's no real browser): real Google in its own window, with its own look and an address bar, Back, Forward, Reload and Home. Links that would open a new tab open in the window instead.
- **Nebulux Store:**
  - Notepad, Calculator, Paint, Clock and Comet Snake;
  - Nebulux AI and Nebulux Arcade, which open in their own windows.
- **Power:** Restart and Shut down really restart and turn off the computer. The power button shuts down cleanly, and closing a laptop lid puts it to sleep.
- **Battery:** the real battery level shows in the taskbar on laptops.

## How it's built

Nebulux OS is a complete system on one bootable disk image (`.iso`). It has these layers:

| Layer | What it is |
|---|---|
| Bootloader | **GRUB** (UEFI, with Secure Boot) and **ISOLINUX** (older BIOS PCs), with the Nebulux OS menu and picture |
| Kernel | the **Linux** kernel, the same kernel Android and ChromeOS run on, with free and non-free drivers and firmware for Wi-Fi, Bluetooth, graphics and sound |
| System | a small Debian 12 base: NetworkManager (Wi-Fi), BlueZ (Bluetooth), PipeWire (sound), X (the screen) |
| Nebulux OS | the screens you see (`index.html`, `css/`, `js/`), shown full screen by a built-in browser engine. The system helper (`system/helper/`) connects them to the hardware. |

At start-up the computer signs in to its own session, starts the system helper, and opens Nebulux OS full screen. The helper listens on 127.0.0.1 only, so other computers can't reach it. Every call needs a key that's made fresh at each start.

### Files

- `index.html`, `css/`, `js/`: Nebulux OS itself. `js/native.js` is the real-computer part.
- `system/helper/nebulux-helper.js`: the system helper (Wi-Fi, Bluetooth, volume, brightness, battery, power).
- `system/browser-ext/`: lets websites show inside Nebulux OS windows, and keeps pop-ups inside the OS.
- `system/iso/`: the .iso build.
  - `build.sh`: the build itself.
  - `packages.list`: what's installed.
  - `root/`: the system files.
  - `nebulux.hook.chroot`: setup steps.
  - `boot-test.sh`: the virtual-computer test.
  - `make-update.sh`: makes the self-update (`nebulux-update.tar.gz` and `update.json`) that goes in each release.
- `.github/workflows/iso.yml`: builds the .iso on GitHub, boot-tests it, and puts it in Releases.

### Make a new .iso

On GitHub, open **Actions** → **Build Nebulux OS** → **Run workflow**. It takes about 30 to 60 minutes, all on GitHub's own computers. Then:

1. It starts the new .iso in a virtual computer, once the old way (BIOS) and once the new way (UEFI).
2. It makes an account, opens Google and Settings, and saves screenshots under **boot-screens**.
3. Only if that works does it put the .iso in **Releases**, with the self-update files. Computers already on Nebulux OS find the update from `update.json` in the newest release.

The version number is in two places: `NX_VERSION` in `.github/workflows/iso.yml` and `NX.version` in `js/whatsnew.js` (with that version's What's new list). The build stops if they don't match.

### Try it without a USB

Open `index.html` in a browser. That's the same OS in a browser tab; Wi-Fi and Bluetooth there are limited to what a browser allows.

### Tests

- `node tests/e2e.cjs [width height]` and `node tests/files.cjs [width height]` drive the whole OS in a headless browser. It needs Edge or Chrome with `--remote-debugging-port=9333`.
- `node tests/native.cjs` tests real-computer mode against the helper with made-up devices:
  1. Run `NX_FAKE=1 node system/helper/nebulux-helper.js .`.
  2. Start Edge or Chrome with `--remote-debugging-port=9334 --load-extension=system/browser-ext`.
  3. Run the test.

© Nebulux LLC
