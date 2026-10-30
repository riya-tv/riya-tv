# Riya TV Live Broadcast Site (GitHub Pages Ready)

A modern, responsive, ultra-low latency live streaming web platform engineered to faithfully replicate the design and user experience of the **Riya TV Android Application** (`/var/www/nanbateam/app/riya`).

---

## 🌟 Key Features

1. **Faithful Android App Design Match**:
   - Deep navy vertical gradient background (`#000137` to `#00029b`).
   - Authentic header with official Riya TV logo and pulsing "LIVE ON AIR" badge.
   - 6 Social Media channel icons (Facebook, Instagram, YouTube, WhatsApp, Twitter/X, Website) with interactive brand glow effects.
   - Auto-rotating Sponsored Banners carousel (cycling every 3 seconds matching the Android app's `The_slide_timer`) with ambient blur backdrop and touch-swipe support.
   - Distinctive "FOR ADVERTISEMENT" oval capsule button flanked by animated left/right arrows (`arrow_left.png`, `arrow_right.png`) with one-click direct dialing (`tel:+919787790707`).
   - Signature "powered by : nanbateam.com" typography in Berkshire Swash font.

2. **Both Mobile & Laptop Responsive**:
   - **Mobile Devices (< 768px)**: Seamless full-screen fluid mobile experience with thumb-friendly controls and touch gestures.
   - **Laptop & Desktop Screens (>= 768px)**:
     - **Laptop Theater View**: Widescreen dual-column broadcaster dashboard showcasing the HD stream in 16:9 cinematic aspect ratio alongside banners and live broadcast stats.
     - **Mobile App View**: Authentic smartphone chassis frame emulating physical flagship hardware (dynamic notch, status bar, and native app aspect ratio).
     - **Interactive Switcher**: One-click toggle in the top bar allowing viewers on laptops to switch modes instantly.

3. **RTMP Streaming Engine**:
   - Ingests studio feeds over **RTMP** on port `34001` via **MediaMTX**.
   - Universal playback in web browsers via low-latency HLS (`https://riya.live.tv.nanbateam.com/live/stream/index.m3u8`).
   - Native Apple HLS support on iOS Safari & macOS.
   - Click-to-unmute sound overlay to gracefully comply with modern browser autoplay policies.
   - Reconnect resilience with automatic exponential backoff.
   - Built-in **RTMP Broadcast Hub modal** displaying server ingest URL, stream keys, and VLC / MX Player network stream links.

---

## 🚀 GitHub Pages Deployment

This static site is completely standalone with zero build or runtime dependencies. It can be hosted on GitHub Pages in three ways:

### Option 1: GitHub Actions Workflow (Recommended)
Pushes to `master` automatically trigger `.github/workflows/deploy-tvlive.yml` which publishes this directory directly to GitHub Pages.

### Option 2: Deploy from `/docs` Folder
The contents are synchronized to the `/docs` directory in the repository root.
In your GitHub Repository:
1. Navigate to **Settings** &rarr; **Pages**.
2. Under **Build and deployment** &rarr; **Source**, select **Deploy from a branch**.
3. Choose branch `master` and folder `/docs`.
4. Click **Save**.

### Option 3: Dedicated `gh-pages` Branch
The directory can be pushed to the `gh-pages` branch for direct hosting at `https://<username>.github.io/<repo>/`.
