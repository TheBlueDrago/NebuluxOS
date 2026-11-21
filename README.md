# Nebulux OS

Nebulux OS is a real operating system that starts from a USB stick. It looks and works like Windows 11, with Nebulux designs. It has:

- a lock screen and sign-in;
- the desktop with Start and the taskbar;
- Settings, Google and the Nebulux Store.

It runs on the computer itself, not inside Windows. It never touches the computer's own drive: take the USB out and restart, and the computer starts the way it always did.

---

## Part 1: Download Nebulux OS

1. Open this repo on GitHub: **TheBlueDrago/NebuluxOS**. The repo is private, so you have to be signed in to GitHub.
2. On the right side, click **Releases**, then the newest **Nebulux OS** release.
3. Under **Assets**, click **`nebulux-os.iso`** to download it. It's about 1.5 GB.
4. *(Optional)* To check that the download isn't damaged, open PowerShell in your Downloads folder and run
   `Get-FileHash .\nebulux-os.iso`. The number it shows should match the `SHA-256` on the release page.

## Part 2: Put it on your USB

> **Writing Nebulux OS to a USB erases everything on that USB.** Copy your files off it first.
> The USB needs to be **4 GB or bigger**. Yours (SanDisk Cruzer Spark, 32 GB) is fine.

1. **Back up the USB.** Plug it in, open it in File Explorer, and copy everything you want to keep to a folder on your computer.
2. **Get Rufus.** It's a free, well-known USB tool. Download it only from its official site, **rufus.ie** (the "Rufus Portable" one is fine).
3. **Open Rufus** and choose these settings:
   - **Device:** your USB stick. Check the name and size, because whatever you pick here gets erased.
   - **Boot selection:** click **SELECT** and pick `nebulux-os.iso`.
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
4. The **Nebulux OS** menu shows for 3 seconds, then Nebulux OS starts. In about 30 to 60 seconds you'll see the Nebulux OS lock screen.
5. The first time, make your account (name and password). Next time, sign in with it.

**To go back to Windows:** use Start → Power → **Shut down**, take the USB out, and turn the computer on. Windows starts like always.

### If it doesn't start

- **It goes straight to Windows.** You didn't hit the boot menu key in time: restart and tap it as soon as the screen turns on. Or use the Shift + Restart way above.
- **"Secure Boot violation" or a red warning.** Nebulux OS supports Secure Boot, but some computers still refuse. Turn **Secure Boot** off in the computer's setup screen: usually **F2**, **Del** or **F10** at power-on, under Boot or Security. You can turn it back on afterwards.
- **Only a blinking line or a black screen for more than 2 minutes.** Restart, and in the Nebulux OS menu choose **Nebulux OS (safe mode)**.
- **Mac computers.** Hold **Option (⌥)** at power-on and choose "EFI Boot". Macs with Apple chips (M1 and newer) can't start other systems from USB.

---

## What's in it

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
- **Google:** real Google in its own window, with its own look and an address bar, Back, Forward, Reload and Home. Links that would open a new tab open in the window instead.
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
- `.github/workflows/iso.yml`: builds the .iso on GitHub, boot-tests it, and puts it in Releases.

### Make a new .iso

On GitHub, open **Actions** → **Build Nebulux OS** → **Run workflow**. It takes about 30 to 60 minutes, all on GitHub's own computers. Then:

1. It starts the new .iso in a virtual computer, once the old way (BIOS) and once the new way (UEFI).
2. It makes an account, opens Google and Settings, and saves screenshots under **boot-screens**.
3. Only if that works does it put the .iso in **Releases**.

### Try it without a USB

Open `index.html` in a browser. That's the same OS in a browser tab; Wi-Fi and Bluetooth there are limited to what a browser allows.

### Tests

- `node tests/e2e.cjs [width height]` drives the whole OS in a headless browser. It needs Edge or Chrome with `--remote-debugging-port=9333`.
- `node tests/native.cjs` tests real-computer mode against the helper with made-up devices:
  1. Run `NX_FAKE=1 node system/helper/nebulux-helper.js .`.
  2. Start Edge or Chrome with `--remote-debugging-port=9334 --load-extension=system/browser-ext`.
  3. Run the test.

© Nebulux LLC
