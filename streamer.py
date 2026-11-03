#!/usr/bin/env python3
"""
TuneWave Terminal - iTunes Search & Stream CLI
Demonstrates raw interactions with the Apple iTunes Search & Lookup API.
"""

import sys
import json
import argparse
import urllib.parse
import urllib.request
import webbrowser
import os

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup"

def search_itunes(term, media="music", entity="song", country="US", limit=15, explicit=True):
    """Query the Apple iTunes Search API."""
    params = {
        "term": term,
        "media": media,
        "entity": entity,
        "country": country,
        "limit": limit,
        "explicit": "Yes" if explicit else "No"
    }
    url = f"{ITUNES_SEARCH_URL}?{urllib.parse.urlencode(params)}"
    
    req = urllib.request.Request(url, headers={"User-Agent": "TuneWave-CLI/1.0"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", [])
    except Exception as e:
        print(f"Error fetching from iTunes API: {e}", file=sys.stderr)
        return []

def print_table(results):
    """Print results in a clean formatted table."""
    if not results:
        print("\nNo results found.")
        return

    print("\n" + "=" * 105)
    print(f"{'#':<3} | {'Title':<30} | {'Artist':<22} | {'Album':<25} | {'Genre':<10} | {'Dur':<5}")
    print("=" * 105)

    for idx, item in enumerate(results, 1):
        title = item.get("trackName") or item.get("collectionName") or "N/A"
        artist = item.get("artistName") or "N/A"
        album = item.get("collectionName") or "N/A"
        genre = item.get("primaryGenreName") or "N/A"
        duration_ms = item.get("trackTimeMillis", 0)
        dur = f"{duration_ms // 60000}:{(duration_ms % 60000) // 1000:02d}" if duration_ms else "--:--"

        title_str = (title[:27] + "...") if len(title) > 30 else title
        artist_str = (artist[:19] + "...") if len(artist) > 22 else artist
        album_str = (album[:22] + "...") if len(album) > 25 else album
        genre_str = (genre[:8] + "..") if len(genre) > 10 else genre

        print(f"{idx:<3} | {title_str:<30} | {artist_str:<22} | {album_str:<25} | {genre_str:<10} | {dur:<5}")

    print("=" * 105)

def main():
    parser = argparse.ArgumentParser(description="TuneWave: iTunes Search & Stream CLI")
    parser.add_argument("query", nargs="?", default=None, help="Search query (e.g. 'Daft Punk', 'Bohemian Rhapsody')")
    parser.add_argument("--media", default="music", choices=["movie", "podcast", "music", "musicVideo", "audiobook", "shortFilm", "tvShow", "software", "ebook", "all"], help="Media type filter")
    parser.add_argument("--entity", default="song", help="Entity type (e.g. song, album, musicArtist, podcast, podcastEpisode)")
    parser.add_argument("--country", default="US", help="Two-letter storefront country code (e.g. US, GB, IN, JP)")
    parser.add_argument("--limit", type=int, default=15, help="Number of results (1-200)")
    parser.add_argument("--open-web", action="store_true", help="Launch the TuneWave web UI in your default browser")
    parser.add_argument("--play", type=int, default=None, help="Automatically open preview for track number (1-based)")

    args = parser.parse_args()

    if args.open_web:
        html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "index.html"))
        webbrowser.open(f"file://{html_path}")
        print(f"[+] Opened {html_path} in your browser.")
        if not args.query:
            return

    term = args.query
    if not term:
        print(r"""
  _______                _          __      __
 |__   __|              | |         \ \    / /
    | |_   _ _ __   ___ | |   _ _ __ \ \  / /_ _   _ _____
    | | | | | '_ \ / _ \| |  | | '_ \ \ \/ / _` \ \ / / _ \
    | | |_| | | | |  __/| |__| | |_) | \  / (_| |\ V /  __/
    |_|\__,_|_| |_|\___(_)____/| .__/   \/ \__,_| \_/ \___|
                               | |   iTunes API Streamer
                               |_|
        """)
        term = input("Search query (song, artist, or album) [default: Queen]: ").strip()
        if not term:
            term = "Queen"

    print(f"\n[+] Searching iTunes Store API for '{term}' (Country: {args.country}, Media: {args.media})...")
    results = search_itunes(term, media=args.media, entity=args.entity, country=args.country, limit=args.limit)
    print_table(results)

    if args.play is not None and 1 <= args.play <= len(results):
        item = results[args.play - 1]
        preview_url = item.get("previewUrl")
        if preview_url:
            print(f"\n[▶] Streaming: {item.get('artistName')} - {item.get('trackName')}")
            print(f"    Preview URL: {preview_url}")
            webbrowser.open(preview_url)
        return

    # If running interactively
    if not args.query:
        while True:
            choice = input("\nEnter track # to stream preview, (s)earch again, (o)pen web app, or (q)uit: ").strip()
            if choice.lower() == 'q':
                break
            elif choice.lower() == 's':
                term = input("New search query: ").strip()
                if term:
                    results = search_itunes(term, limit=args.limit)
                    print_table(results)
            elif choice.lower() == 'o':
                html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "index.html"))
                webbrowser.open(f"file://{html_path}")
                print(f"[+] Opened {html_path} in your browser.")
            elif choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(results):
                    item = results[idx]
                    preview_url = item.get("previewUrl")
                    track_name = item.get("trackName", "Track")
                    artist_name = item.get("artistName", "Artist")

                    if not preview_url:
                        print(f"[-] No preview stream available for '{track_name}'.")
                        continue

                    print(f"\n[▶] Playing 30-second preview: {artist_name} - {track_name}")
                    print(f"    Preview Stream URL: {preview_url}")
                    print(f"    Apple Music URL:    {item.get('trackViewUrl', 'N/A')}")
                    webbrowser.open(preview_url)
                else:
                    print("[-] Invalid track number.")

if __name__ == "__main__":
    main()
