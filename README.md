# TuneWave 🎵 - iTunes Music Searcher & Streamer

A sleek, responsive music search engine and audio streamer powered completely by the free, unauthenticated **Apple iTunes Search & Lookup API**.

---

## ✨ Features

- **Instant Real-Time Search**: Query millions of songs, albums, artists, music videos, podcasts, and audiobooks with real-time debouncing.
- **Continuous 30-Second Audio Streaming**: High-fidelity AAC previews streamed directly from Apple's Content Delivery Network (`audio-ssl.itunes.apple.com`).
- **Complete Media Formats**:
  - 🎵 **Songs & Tracks** (30s AAC previews)
  - 💿 **Albums & Discographies**
  - 🎬 **Music Videos & Trailers** (with embedded video player modal)
  - 🎙️ **Podcasts & Episodes** (streams full episodes via direct Megaphone/RSS MP3 audio feeds!)
  - 📚 **Audiobooks & Authors**
- **Retina High-Res Artwork**: Automatic dynamic resolution upgrading from standard 100×100 thumbnail to 600×600 and 1200×1200 retina artwork.
- **Audio Spectrum Visualizer**: Real-time frequency visualizer using HTML5 Web Audio API `AnalyserNode`.
- **Queue & Playlist Management**: Auto-advance to the next track when a preview finishes, repeat modes (All / Single Track), and shuffle mode.
- **Storefront & Country Selector**: Switch between US, UK, Japan, Germany, France, India, Canada, Australia, and more to browse country-specific catalogs and charts.
- **Zero Dependencies**: Pure HTML5, CSS3, and modern Vanilla JavaScript — runs standalone without requiring `npm install` or any build tooling.
- **Keyboard Shortcuts**:
  - `Space`: Play / Pause
  - `←` / `→`: Seek ±5 seconds
  - `N`: Next track in queue
  - `P`: Previous track
  - `M`: Mute / Unmute
  - `/`: Focus search bar
  - `S`: Toggle shuffle
  - `R`: Toggle repeat mode
  - `Esc`: Close open modal / queue drawer

---

## 🚀 Quickstart

### Option 1: Double-Click or Open in Browser (Instant)
Simply open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Run a Local Server
```bash
# In the itunes-music-streamer directory:
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

### Option 3: Terminal CLI Mode
Search, inspect, and stream directly from the command line using `streamer.py`:

```bash
# Interactive mode
python streamer.py

# Direct query mode
python streamer.py "Coldplay" --limit 10

# Search podcasts
python streamer.py "Huberman Lab" --entity podcastEpisode --limit 5

# Launch the web interface from terminal
python streamer.py --open-web
```
