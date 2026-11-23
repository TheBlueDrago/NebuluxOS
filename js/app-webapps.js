// Real apps (from Flathub, the Linux app store) and the web versions of the apps people know from other app stores: streaming, music, chat, Office, Google, AI, games
// and more. "Get" puts them in Start and on the desktop. On the real Nebulux OS each one opens in its own app window
// (the real web browser, without tabs); in a browser tab it opens in a new tab.
// The tiles are Nebulux-made: the app's colors and initials, not the companies' own logos.
"use strict";
(function () {
  // [id, name, address, category, tile colors, initials, initials color, publisher, rating, description]
  const L = [
    // Entertainment
    ["netflix", "Netflix", "https://www.netflix.com/", "Entertainment", "#e50914,#7a0309", "N", "#fff", "Netflix", "4.6", "Watch TV shows and movies, anime, documentaries and more."],
    ["disneyplus", "Disney+", "https://www.disneyplus.com/", "Entertainment", "#1a3ccc,#071a5c", "D+", "#fff", "Disney", "4.5", "Stream Disney, Pixar, Marvel, Star Wars and National Geographic."],
    ["primevideo", "Prime Video", "https://www.primevideo.com/", "Entertainment", "#1399ff,#0a4c8c", "pv", "#fff", "Amazon", "4.4", "Movies, series and live sports with Prime."],
    ["hulu", "Hulu", "https://www.hulu.com/", "Entertainment", "#1ce783,#0e8a4d", "hulu", "#06240f", "Hulu", "4.3", "Stream hit shows, movies and originals."],
    ["max", "Max", "https://www.max.com/", "Entertainment", "#2f4cff,#0b1a8f", "max", "#fff", "Warner Bros. Discovery", "4.3", "HBO, Warner Bros. movies, series and more."],
    ["twitch", "Twitch", "https://www.twitch.tv/", "Entertainment", "#9146ff,#4b1ea8", "Tw", "#fff", "Twitch", "4.5", "Watch live streams of games, music and creators."],
    ["crunchyroll", "Crunchyroll", "https://www.crunchyroll.com/", "Entertainment", "#f47521,#a3420a", "CR", "#fff", "Crunchyroll", "4.6", "The biggest library of anime, with new episodes after Japan."],
    ["tubi", "Tubi", "https://tubitv.com/", "Entertainment", "#7a24ff,#3a0d8a", "tubi", "#fde047", "Tubi", "4.4", "Free movies and TV, no subscription."],
    // Music
    ["spotify", "Spotify", "https://open.spotify.com/", "Music", "#1ed760,#0b7a35", "S", "#04210f", "Spotify", "4.7", "Music and podcasts: playlists, albums and your library."],
    ["ytmusic", "YouTube Music", "https://music.youtube.com/", "Music", "#ff2a2a,#8a0000", "YM", "#fff", "Google", "4.5", "Songs, albums, live performances and remixes."],
    ["soundcloud", "SoundCloud", "https://soundcloud.com/", "Music", "#ff6a1a,#b33a00", "SC", "#fff", "SoundCloud", "4.4", "Discover new music from creators everywhere."],
    ["applemusic", "Apple Music", "https://music.apple.com/", "Music", "#fa2d48,#9a0a1f", "AM", "#fff", "Apple", "4.4", "Over 100 million songs, curated playlists and radio."],
    // Social
    ["whatsapp", "WhatsApp", "https://web.whatsapp.com/", "Social", "#25d366,#0b7a3a", "W", "#fff", "WhatsApp", "4.6", "Message and call your friends. Link it with the WhatsApp on your phone."],
    ["instagram", "Instagram", "https://www.instagram.com/", "Social", "#fd5949,#d6249f,#285aeb", "IG", "#fff", "Instagram", "4.5", "Photos, reels and stories from friends and creators."],
    ["tiktok", "TikTok", "https://www.tiktok.com/", "Social", "#111111,#2b2b2b", "TT", "#25f4ee", "TikTok", "4.5", "Short videos: dance, comedy, food, sports and more."],
    ["discord", "Discord", "https://discord.com/app", "Social", "#5865f2,#2b33a8", "D", "#fff", "Discord", "4.7", "Talk, chat and hang out with your friends and communities."],
    ["facebook", "Facebook", "https://www.facebook.com/", "Social", "#1877f2,#0a3d8f", "f", "#fff", "Meta", "4.2", "Connect with friends, family and groups."],
    ["messenger", "Messenger", "https://www.messenger.com/", "Social", "#0099ff,#a033ff", "M", "#fff", "Meta", "4.3", "Chat and video call your Facebook friends."],
    ["x", "X", "https://x.com/", "Social", "#111111,#333333", "X", "#fff", "X Corp.", "4.0", "See what's happening in the world right now."],
    ["reddit", "Reddit", "https://www.reddit.com/", "Social", "#ff4500,#a32b00", "r", "#fff", "Reddit", "4.4", "Communities for every interest, with posts and discussions."],
    ["pinterest", "Pinterest", "https://www.pinterest.com/", "Social", "#e60023,#8c0015", "P", "#fff", "Pinterest", "4.5", "Find ideas for recipes, homes, style and more."],
    ["snapchat", "Snapchat", "https://web.snapchat.com/", "Social", "#fffc00,#e8c800", "S", "#111", "Snap", "4.2", "Chat and call your Snapchat friends."],
    ["telegram", "Telegram", "https://web.telegram.org/", "Social", "#2aabee,#1170a8", "T", "#fff", "Telegram", "4.6", "Fast, secure messaging with groups and channels."],
    ["linkedin", "LinkedIn", "https://www.linkedin.com/", "Social", "#0a66c2,#06386b", "in", "#fff", "LinkedIn", "4.3", "Your professional network: jobs, people and news."],
    // Productivity (Microsoft 365 and Google)
    ["m365", "Microsoft 365", "https://www.office.com/", "Productivity", "#f25022,#7fba00,#00a4ef", "365", "#fff", "Microsoft", "4.5", "Word, Excel, PowerPoint and your files in one place."],
    ["word", "Word", "https://www.office.com/launch/word", "Productivity", "#2b7cd3,#103f91", "W", "#fff", "Microsoft", "4.5", "Write and edit documents, on the web."],
    ["excel", "Excel", "https://www.office.com/launch/excel", "Productivity", "#21a366,#0e5c3a", "X", "#fff", "Microsoft", "4.5", "Spreadsheets, charts and formulas, on the web."],
    ["powerpoint", "PowerPoint", "https://www.office.com/launch/powerpoint", "Productivity", "#ed6c47,#a33316", "P", "#fff", "Microsoft", "4.5", "Make slideshows and presentations, on the web."],
    ["outlook", "Outlook", "https://outlook.live.com/", "Productivity", "#1490df,#0a4c8c", "O", "#fff", "Microsoft", "4.4", "Email and calendar for Outlook.com and Hotmail."],
    ["onedrive", "OneDrive", "https://onedrive.live.com/", "Productivity", "#1490df,#0364b8", "OD", "#fff", "Microsoft", "4.4", "Your files and photos in Microsoft's cloud."],
    ["teams", "Microsoft Teams", "https://teams.microsoft.com/", "Productivity", "#7b83eb,#4b53bc", "T", "#fff", "Microsoft", "4.3", "Chat, meet and call with your team or class."],
    ["gmail", "Gmail", "https://mail.google.com/", "Productivity", "#ea4335,#a5241a", "M", "#fff", "Google", "4.6", "Google's email: read, write and search your mail."],
    ["gdocs", "Google Docs", "https://docs.google.com/document/", "Productivity", "#4285f4,#1a53b5", "Docs", "#fff", "Google", "4.6", "Write documents together, in real time."],
    ["gsheets", "Google Sheets", "https://docs.google.com/spreadsheets/", "Productivity", "#0f9d58,#0a6b3c", "Sh", "#fff", "Google", "4.6", "Spreadsheets you can share and edit together."],
    ["gslides", "Google Slides", "https://docs.google.com/presentation/", "Productivity", "#f4b400,#b37f00", "Sl", "#fff", "Google", "4.5", "Make presentations with others."],
    ["gdrive", "Google Drive", "https://drive.google.com/", "Productivity", "#1fa463,#4688f4,#ffd04b", "Dr", "#fff", "Google", "4.6", "Store, share and open your files from anywhere."],
    ["gcalendar", "Google Calendar", "https://calendar.google.com/", "Productivity", "#4285f4,#1a53b5", "31", "#fff", "Google", "4.6", "Your schedule, events and reminders."],
    ["gmeet", "Google Meet", "https://meet.google.com/", "Productivity", "#00897b,#00574b", "Me", "#fff", "Google", "4.4", "Video calls and meetings."],
    ["zoom", "Zoom", "https://app.zoom.us/wc", "Productivity", "#2d8cff,#0b5cce", "Z", "#fff", "Zoom", "4.4", "Join and host video meetings."],
    ["slack", "Slack", "https://app.slack.com/", "Productivity", "#4a154b,#2b0b2c", "S", "#ecb22e", "Slack", "4.5", "Channels and chats for teams."],
    ["notion", "Notion", "https://www.notion.so/", "Productivity", "#f5f5f5,#cfcfcf", "N", "#111", "Notion", "4.6", "Notes, docs, tasks and wikis in one place."],
    ["trello", "Trello", "https://trello.com/", "Productivity", "#0c66e4,#09326c", "Tr", "#fff", "Atlassian", "4.5", "Boards and cards to organize anything."],
    ["gmaps", "Google Maps", "https://www.google.com/maps", "Utilities", "#34a853,#4285f4,#fbbc04", "Map", "#fff", "Google", "4.6", "Maps, directions, places and traffic."],
    ["translate", "Google Translate", "https://translate.google.com/", "Utilities", "#4285f4,#1a53b5", "Aa", "#fff", "Google", "4.6", "Translate words, sentences and pages between 100+ languages."],
    ["gphotos", "Google Photos", "https://photos.google.com/", "Utilities", "#fbbc04,#ea4335,#4285f4", "Ph", "#fff", "Google", "4.6", "Your photo library, backed up and searchable."],
    ["speedtest", "Speedtest", "https://www.speedtest.net/", "Utilities", "#141526,#3a3d5c", "ST", "#00d4ff", "Ookla", "4.6", "Test how fast your internet is."],
    // Creativity
    ["canva", "Canva", "https://www.canva.com/", "Creativity", "#00c4cc,#7d2ae8", "C", "#fff", "Canva", "4.7", "Design posts, videos, presentations and more."],
    ["figma", "Figma", "https://www.figma.com/", "Creativity", "#a259ff,#f24e1e", "F", "#fff", "Figma", "4.6", "Design apps and websites together."],
    ["photopea", "Photopea", "https://www.photopea.com/", "Creativity", "#18a497,#0b5e56", "Pp", "#fff", "Photopea", "4.6", "A full photo editor that opens PSD files."],
    ["capcut", "CapCut", "https://www.capcut.com/editor", "Creativity", "#111111,#333333", "CC", "#fff", "CapCut", "4.4", "Edit videos with effects, captions and music."],
    // AI
    ["chatgpt", "ChatGPT", "https://chatgpt.com/", "AI", "#10a37f,#0a6b53", "GPT", "#fff", "OpenAI", "4.6", "Chat with an AI that writes, explains and brainstorms."],
    ["copilot", "Microsoft Copilot", "https://copilot.microsoft.com/", "AI", "#2870ea,#b146c2", "Co", "#fff", "Microsoft", "4.4", "Microsoft's AI companion."],
    ["gemini", "Gemini", "https://gemini.google.com/", "AI", "#4796e3,#9177c7", "Ge", "#fff", "Google", "4.5", "Google's AI for writing, planning and learning."],
    ["claude", "Claude", "https://claude.ai/", "AI", "#d97757,#8f4527", "Cl", "#fff", "Anthropic", "4.7", "An AI for writing, analysis, coding and more."],
    // Games
    ["xboxcloud", "Xbox Cloud Gaming", "https://www.xbox.com/play", "Games", "#107c10,#064206", "Xbox", "#fff", "Microsoft", "4.4", "Play Xbox games in the cloud with Game Pass Ultimate."],
    ["geforcenow", "GeForce NOW", "https://play.geforcenow.com/", "Games", "#76b900,#3f6300", "GFN", "#fff", "NVIDIA", "4.4", "Play your PC games from Steam and more in the cloud."],
    ["chess", "Chess.com", "https://www.chess.com/", "Games", "#81b64c,#4a7a24", "Ch", "#fff", "Chess.com", "4.7", "Play chess online, solve puzzles and learn."],
    ["mcclassic", "Minecraft Classic", "https://classic.minecraft.net/", "Games", "#62b47a,#795548", "MC", "#fff", "Mojang", "4.3", "The original 2009 Minecraft, free in the browser."],
    ["poki", "Poki", "https://poki.com/", "Games", "#ff5d6a,#3c8dff", "Poki", "#fff", "Poki", "4.5", "Thousands of free browser games."],
    ["wordle", "Wordle", "https://www.nytimes.com/games/wordle/", "Games", "#6aaa64,#3d6b38", "Wd", "#fff", "The New York Times", "4.6", "Guess the five-letter word in six tries."],
    // Shopping and learning
    ["amazon", "Amazon", "https://www.amazon.com/", "Shopping", "#ff9900,#232f3e", "a", "#fff", "Amazon", "4.5", "Shop millions of items with fast delivery."],
    ["ebay", "eBay", "https://www.ebay.com/", "Shopping", "#e53238,#0064d2", "eb", "#fff", "eBay", "4.4", "Buy and sell new and used things."],
    ["walmart", "Walmart", "https://www.walmart.com/", "Shopping", "#0071ce,#003e7e", "W", "#ffc220", "Walmart", "4.3", "Groceries, electronics and everyday low prices."],
    ["etsy", "Etsy", "https://www.etsy.com/", "Shopping", "#f1641e,#a23b06", "E", "#fff", "Etsy", "4.4", "Handmade and one-of-a-kind items."],
    ["duolingo", "Duolingo", "https://www.duolingo.com/", "Education", "#58cc02,#2f7a00", "Du", "#fff", "Duolingo", "4.7", "Learn a language with short, fun lessons."],
    ["khan", "Khan Academy", "https://www.khanacademy.org/", "Education", "#14bf96,#0a6b55", "K", "#fff", "Khan Academy", "4.7", "Free lessons in math, science and more."],
    ["wikipedia", "Wikipedia", "https://www.wikipedia.org/", "Education", "#f5f5f5,#bdbdbd", "W", "#111", "Wikimedia", "4.7", "The free encyclopedia."],
    ["classroom", "Google Classroom", "https://classroom.google.com/", "Education", "#0f9d58,#f4b400", "Cls", "#fff", "Google", "4.4", "Your classes, assignments and grades."],
  ];
  // real apps from Flathub, the Linux app store: [id, name, category, colors, initials, color, publisher, rating, description, Flathub id, window class, web address (optional)]
  const NATIVE = [
    ["steam", "Steam", "Games", "#1b2838,#2a475e", "St", "#66c0f4", "Valve", "4.7", "Thousands of PC games, your library and friends. Many Windows games play on Nebulux OS through Steam's Proton.", "com.valvesoftware.Steam", "steam"],
    ["minecraft", "Minecraft", "Games", "#62b47a,#795548", "MC", "#fff", "Mojang", "4.7", "The full Minecraft: Java Edition launcher (sign in with your Microsoft account).", "com.mojang.Minecraft", "minecraft-launcher"],
    ["vlc", "VLC", "Entertainment", "#ff8800,#c45500", "VLC", "#fff", "VideoLAN", "4.8", "Plays almost every video and music file, DVDs and streams.", "org.videolan.VLC", "vlc"],
    ["obs", "OBS Studio", "Creativity", "#302e31,#5c5a5e", "OBS", "#fff", "OBS Project", "4.7", "Record your screen and stream live.", "com.obsproject.Studio", "obs"],
    ["gimp", "GIMP", "Creativity", "#5c5543,#8a7f62", "Gi", "#fff", "The GIMP team", "4.5", "A powerful photo editor and painting program.", "org.gimp.GIMP", "gimp"],
    ["krita", "Krita", "Creativity", "#3babff,#1a5c99", "Kr", "#fff", "KDE", "4.7", "Digital painting for artists.", "org.kde.krita", "krita"],
    ["blender", "Blender", "Creativity", "#ea7600,#265787", "Bl", "#fff", "Blender Foundation", "4.8", "3D modeling, animation and video editing.", "org.blender.Blender", "blender"],
    ["libreoffice", "LibreOffice", "Productivity", "#18a303,#0d5c02", "LO", "#fff", "The Document Foundation", "4.6", "A free office suite: documents, spreadsheets and slides that open Word, Excel and PowerPoint files.", "org.libreoffice.LibreOffice", "libreoffice"],
    ["firefox", "Firefox", "Utilities", "#ff9500,#e31587", "Fx", "#fff", "Mozilla", "4.6", "The fast, private web browser.", "org.mozilla.firefox", "firefox"],
    ["chrome", "Google Chrome", "Utilities", "#4285f4,#34a853", "Ch", "#fff", "Google", "4.6", "Google's web browser, with your Google account and extensions.", "com.google.Chrome", "google-chrome"],
    ["vscode", "Visual Studio Code", "Productivity", "#23a9f2,#0065a9", "VS", "#fff", "Microsoft", "4.8", "A code editor for every language.", "com.visualstudio.code", "code"],
    ["signal", "Signal", "Social", "#3a76f0,#1d4fb8", "Si", "#fff", "Signal", "4.7", "Private messages and calls. Link it with Signal on your phone.", "org.signal.Signal", "signal"],
    ["audacity", "Audacity", "Music", "#0000cc,#ff6600", "Au", "#fff", "Audacity", "4.6", "Record and edit audio.", "org.audacityteam.Audacity", "audacity"],
  ];
  // apps above that also have a real app on Flathub (the real app is used on the Nebulux OS USB)
  const LOGO = { mcclassic: "w:www.minecraft.net", gmaps: "w:maps.google.com", word: "w:word.cloud.microsoft", excel: "w:excel.office.com", powerpoint: "w:powerpoint.cloud.microsoft", gdocs: "g:docs", gsheets: "g:sheets", gslides: "g:slides" }, ALSO = { spotify: ["com.spotify.Client", "spotify"], discord: ["com.discordapp.Discord", "discord"], zoom: ["us.zoom.Zoom", "zoom"], slack: ["com.slack.Slack", "slack"], telegram: ["org.telegram.desktop", "telegramdesktop"] };
  NX.webApps = [];
  for (const [id, name, url, category, cols, text, fg, publisher, rating, desc] of L) {
    NX.webApps.push(id);
    // its own logo: the real app's icon from Flathub when there is one, otherwise the website's own icon
    const logo = ALSO[id] ? "|f:" + ALSO[id][0] : "|" + (LOGO[id] || "w:" + new URL(url).hostname);
    NX.apps[id] = { name, url, category, rating, publisher, webapp: true, size: "Web app", desc, icon: "brand:" + cols + ":" + text + ":" + fg + logo };
    if (ALSO[id]) NX.apps[id].native = { flatpak: ALSO[id][0], wm: ALSO[id][1] };
  }
  for (const [id, name, category, cols, text, fg, publisher, rating, desc, flatpak, wm] of NATIVE)
    NX.apps[id] = { name, category, rating, publisher, desc, native: { flatpak, wm }, size: "App", icon: "brand:" + cols + ":" + text + ":" + fg + "|f:" + flatpak };
})();
