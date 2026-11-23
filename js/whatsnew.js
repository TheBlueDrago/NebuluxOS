// The Nebulux OS version, and what's new in it (shown once after an update, the first time someone signs in).
"use strict";
(function () {
  NX.version = "3.2";
  NX.whatsNew = [
    ["Wi-Fi on newer laptops", "Nebulux OS now runs on the newer Linux kernel 6.12, with drivers for Wi-Fi 6 and 6E chips that had none before: Realtek RTL8852BE, RTL8852AE, RTL8852CE and RTL8922AE (in many Lenovo, HP and ASUS laptops), MediaTek MT7921 and MT7922, and the newest Intel chips. Their Bluetooth works too."],
    ["Wi-Fi that stays connected", "Wi-Fi power saving and changing addresses are off, which kept Realtek and MediaTek chips dropping the connection. Lenovo IdeaPads whose Wi-Fi said it was switched off are fixed by themselves."],
    ["Network troubleshooter", "Settings > Network & internet > Troubleshoot checks the Wi-Fi chip, its driver, the Wi-Fi switch, the connection and the internet, says what is wrong in plain words, and Try to fix restarts the Wi-Fi driver and the network for you. It can also save a report to Documents."],
    ["Known and hidden networks", "Forget a saved network that keeps failing, join a hidden network by its name, press Show to see the password while you type it, and Properties shows the connected network's signal, band, speed and IP address."],
    ["Virtual desktops", "Task View (Nebulux + Tab) has your desktops at the bottom: add one, rename it, drag windows between them. Ctrl + Nebulux + Left or Right switches, Ctrl + Nebulux + D adds one, Ctrl + Nebulux + F4 closes it."],
    ["Clipboard history", "Nebulux + V shows the last 25 things you copied, in Nebulux OS and in real apps. Click one to paste it, pin the ones you need often. Turn it off in Settings > System."],
    ["File Explorer tabs", "Ctrl + T opens a tab, Ctrl + W closes it, and a middle-click or Open in new tab opens a folder in its own tab."],
    ["Sticky Notes", "Quick colored notes that save as you type, with search and Undo. Your notes show in Widgets too."],
    ["Focus sessions and alarms", "Clock > Focus: 15 to 60 minutes with Do not disturb on until it is done. Clock > Alarms: wake-up and reminder alarms, once or on the days you pick. Both keep going with Clock closed."],
    ["Calendar events", "Click the clock on the taskbar, pick a day and add an event, with a time if you like. Days with events get a dot, and you get a reminder when one starts."],
    ["Night light on a schedule", "Settings > System: night light comes on and goes off by itself at the hours you pick."],
    ["Storage", "Settings > System > Storage shows how much space is left on your USB, what uses it, and empties the Recycle Bin."],
    ["Get Started", "A quick tour of Nebulux OS with every shortcut. Open it from Start."],
    ["Battery time left", "The battery says how long it will last, or how long until it is full, in quick settings, Settings and Widgets."],
    ["Your own background and picture", "Settings > Personalization > Browse photos makes any picture your background, and Settings > Accounts gives your account a picture for sign-in, Start and Settings."],
    ["Photos, Calculator and more", "Photos plays a slideshow, Calculator keeps a history of answers (and Ctrl + C copies one), color filters (grayscale or inverted) are in Accessibility, the far right corner of the taskbar shows the desktop, and hovering an open app on the taskbar shows a preview of its window."],
    ["A smarter lock screen and Widgets", "The lock screen shows Wi-Fi and the battery. Widgets show your Sticky Notes and the battery."],
    ["Updates by themselves", "Nebulux OS now finds its own updates. Install them tonight (Later), get a reminder in 30 minutes, or skip one (Never) and install it any time from Settings > Nebulux Update."],
    ["Real apps in the Nebulux Store", "Steam, Minecraft, Spotify, Discord, Zoom, Slack, Telegram, VLC, OBS Studio, GIMP, Krita, Blender, LibreOffice, Firefox, Google Chrome, Visual Studio Code, Signal and Audacity install as real apps. Netflix, WhatsApp, Office and about 60 more open as web apps in their own windows."],
    ["Window buttons for every app", "Real apps and app windows have minimize, maximize and close. Minimized apps come back from the taskbar."],
    ["Pin apps your way", "Search in Start and use the details on the right: Open, Pin to taskbar, Show on or Hide from desktop, Uninstall. Or right-click an app on the desktop."],
    ["A USB that doesn't save changes", "Start right away as Guest instead of setting up every time."],
    ["Better Wi-Fi and Bluetooth", "Wi-Fi turns on even when the laptop had it blocked, Bluetooth devices pair more easily, and both say exactly what chip the computer has when something can't work. Opening Google or YouTube without internet takes you to the Wi-Fi list."],
    ["A battery that shows how much is left", "The battery icon's bar goes down as the battery drains: green while charging, orange at 20%, red at 10%. Battery saver (in quick settings and Settings > System) turns it yellow and turns off effects so the battery lasts longer, and it turns on by itself at 20%."],
    ["A better mouse", "The standard pointer speed by default, with Slower and Faster in Settings > Bluetooth & devices > Mouse. The Nebulux Store's rows have arrow buttons, so you never have to aim for a thin scroll bar."],
    ["Settings like you know them", "Home, System, Bluetooth & devices, Network & internet, Personalization, Apps, Accounts, Time & language, Accessibility, Privacy & security and Nebulux Update."],
    ["A real web browser", "Google, YouTube and websites open in a full browser with tabs, Google sign-in, Gmail and YouTube, right above the taskbar."],
    ["Your files", "File Explorer with your folders, the Recycle Bin and USB drives, plus Photos, Media Player and Snipping Tool."],
    ["Screens and TV", "Plug in a TV with HDMI to show Nebulux OS on it, pick where sound plays, or cast to a wireless TV."],
    ["Shortcuts with the Nebulux key", "Nebulux opens Start; Nebulux + Tab, D, E, L, W and the arrow keys do the rest, even over websites. Alt + Tab switches windows."],
    ["First-time setup", "Make your account, then pick your region, keyboard, Wi-Fi, privacy and look, and sign in with Google."],
  ];
})();
