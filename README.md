# Nebulux OS

A desktop operating system in the Windows 11 style, with Nebulux designs. It runs in a web browser tab, so it can't change or harm your computer: closing the tab closes it.

## What's in it

- **Sign-in**:
  - a boot screen, then a lock screen with the clock;
  - click, press a key or swipe up to sign in;
  - first-run account setup, several accounts, wrong-password lockout;
  - only a salted PBKDF2 hash of each password is kept.
- **Home (the desktop)**:
  - Nebulux wallpapers and desktop icons;
  - a centered taskbar (or left-aligned), and a Start menu with search, Pinned, Recommended and power;
  - quick settings: Wi-Fi, Bluetooth, airplane mode, night light, dark mode, brightness, volume;
  - a calendar, notifications and right-click menus.
  - Windows drag, snap (drag to the top to maximize, to a side for half the screen), resize from any edge, minimize, maximize and close.
- **Settings**:
  - System: brightness, night light, volume, network;
  - Personalization: 6 wallpapers, dark or light, accent color, taskbar alignment;
  - Apps: uninstall;
  - Accounts: rename, change password, remove other users;
  - Time & language, and About.
- **Google**: a search page. Searches and shortcuts open Google in a new tab, because Google doesn't let other sites show it inside them.
- **Nebulux Store**:
  - Home, categories, search, app pages, install with progress, and a Library with uninstall.
  - Apps: Notepad, Calculator, Paint, Clock and Comet Snake. Nebulux AI and Nebulux Arcade open on the web.

Everything is saved in your browser (localStorage), per account.

## Run it

Open `index.html` in a browser, or serve the folder with any static file server.

## Test it

`node tests/e2e.cjs [width height]` drives the whole OS in a headless browser. It needs Edge or Chrome running with `--remote-debugging-port=9333`.

© Nebulux LLC
