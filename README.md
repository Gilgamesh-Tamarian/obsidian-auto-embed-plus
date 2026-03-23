[![GitHub manifest version](https://img.shields.io/github/manifest-json/v/Gilgamesh-Tamarian/obsidian-link-iframe)](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/Gilgamesh-Tamarian/obsidian-link-iframe)](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/commits/main/)
[![GitHub Open Issues](https://img.shields.io/github/issues/Gilgamesh-Tamarian/obsidian-link-iframe)](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues)
[![GitHub Closed Issues](https://img.shields.io/github/issues-closed/Gilgamesh-Tamarian/obsidian-link-iframe)](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues?q=is%3Aissue+is%3Aclosed)
[![GitHub License](https://img.shields.io/github/license/Gilgamesh-Tamarian/obsidian-link-iframe)](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/blob/main/LICENSE)

# I link therefore iframe

An [Obsidian](https://obsidian.md/) plugin that turns selected URLs into rich inline embeds — with a live preview to confirm before inserting.

Supports 30+ websites out of the box, can save images and documents to your vault, and exports Quizlet flashcard sets to local Markdown notes.

---

## Table of contents

- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Supported providers](#supported-providers)
- [Features in detail](#features-in-detail)
  - [Embed workflow](#embed-workflow)
  - [Configure embed modal](#configure-embed-modal)
  - [Preload options](#preload-options)
  - [Dark mode](#dark-mode)
  - [Show original link](#show-original-link)
  - [Save images and media to vault](#save-images-and-media-to-vault)
  - [Save Google Docs to vault](#save-google-docs-to-vault)
- [Quizlet vault export](#quizlet-vault-export)
- [Known limitations](#known-limitations)
- [FAQ](#faq)
- [Credits](#credits)

---

## How it works

When you select a URL in the editor and trigger the embed command, the plugin:

1. Identifies the URL's provider (YouTube, Reddit, Quizlet, etc.) using a per-provider regex.
2. Constructs the correct embed URL for that provider — for example, converting a YouTube watch link to a `/embed/` URL, or a Google Drive share link to a `/preview` URL.
3. Optionally runs save-to-vault actions in parallel: image download, Google Doc export, or Quizlet card export.
4. Opens a **Configure Embed** preview modal where you can inspect the live iframe and choose an aspect ratio.
5. Inserts the final `<div><iframe>` block directly into the note at your cursor position.

Embeds are converted into iframe markup and continue to render even if the plugin is disabled or removed.

For URLs that do not match any known provider, the plugin falls back to a generic iframe using oEmbed data where available, or a plain full-page embed otherwise.

> [!NOTE]
> The conversion is not perfect for every website. You can manually edit any part of the generated iframe/details in the note when needed.

---

## Getting started

1. Install the plugin from the Obsidian community plugin browser (ID: `link-iframe`).
2. Enable it under **Settings → Community plugins**.
3. In any note, select (highlight) a URL, then either:
   - Right-click → **Convert URL to embed**, or
   - Open the command palette and run **I link therefore iframe: Create embed**.
4. A preview modal opens. Optionally adjust the aspect ratio, then click **OK**.

---

## Supported providers

### Video

| Provider | Notes |
|---|---|
| [YouTube](https://www.youtube.com/) | All URL forms: watch, short (`youtu.be`), Shorts, Live, embed. Start-time via `?t=` / `?start=` in `1h2m3s` notation |
| [Vimeo](https://vimeo.com/) | |
| [Dailymotion](https://www.dailymotion.com/) | |
| [Twitch](https://www.twitch.tv/) | Channels, VODs (`/videos/`), clips |
| [VK Video](https://vk.com/) | |

### Music & audio

| Provider | Notes |
|---|---|
| [Spotify](https://open.spotify.com/) | Tracks, albums, playlists, artists. Playback limited to 30 s without login |
| [Apple Music](https://music.apple.com/) | Albums, playlists, individual tracks (via `?i=`) |
| [Tidal](https://tidal.com/) | Tracks, albums, playlists, videos |
| [Deezer](https://www.deezer.com/) | Tracks, albums, playlists, artists; light/dark theme follows plugin setting |
| [SoundCloud](https://soundcloud.com/) | |

### Social media & microblogging

| Provider | Notes |
|---|---|
| [Twitter / X](https://x.com/) | Posts and profile timelines. Handles `x.com` only — Obsidian >= 1.7.0 handles `twitter.com` natively |
| [Reddit](https://www.reddit.com/) | Dark mode supported |
| [Instagram](https://www.instagram.com/) | Posts, reels, and profiles |
| [TikTok](https://www.tiktok.com/) | |
| [Facebook](https://www.facebook.com/) | Posts and videos |
| [Mastodon](https://joinmastodon.org/) | Any public instance; validated via the Mastodon API before embedding |
| [Threads](https://www.threads.net/) | |
| [Pinterest](https://www.pinterest.com/) | Individual pins |
| [Telegram](https://t.me/) | Public post links |

### Google services

| Provider | Notes |
|---|---|
| [Google Docs](https://docs.google.com/) | Documents shared with "anyone with the link" |
| [Google Drive](https://drive.google.com/) | File share links (`/file/d/...` and `?id=...`) converted to `/preview` |
| [Google Calendar](https://calendar.google.com/) | Extracts calendar ID from `src` or `cid` query parameter |
| [Google Maps](https://maps.google.com/) | Query links, place links, coordinate links, short `maps.app.goo.gl` links |

### Other

| Provider | Notes |
|---|---|
| [Imgur](https://imgur.com/) | Single images and albums; auto-resizes via postMessage |
| [CodePen](https://codepen.io/) | |
| [Steam](https://store.steampowered.com/) | Store pages |
| [Quizlet](https://quizlet.com/) | Flashcard embed; full vault export available (see [below](#quizlet-vault-export)) |
| [Wikipedia](https://www.wikipedia.org/) | Any language subdomain |
| [Geogebra](https://www.geogebra.org/) | Material iframes |
| [OpenStreetMap](https://www.openstreetmap.org/) | Marker + bounding-box embed |

For any URL that does not match a known provider, the plugin attempts a generic oEmbed lookup and falls back to a full-page iframe.

---

## Features in detail

### Embed workflow

There are two equivalent ways to trigger an embed:

- **Context menu** — Select a URL, right-click, choose **Convert URL to embed**.
- **Command palette** — Select a URL, run **I link therefore iframe: Create embed**.

Both open the [Configure Embed modal](#configure-embed-modal) before inserting anything into the note.

#### Migrating legacy embeds

If you have notes using the old `![](url)` Markdown embed syntax from a previous version of this plugin, run the command **I link therefore iframe: Migrate legacy embeds in current note** to convert them to the current HTML format.

---

### Configure embed modal

Before the embed is inserted you see a live preview of the iframe. From here you can:

- **Choose an aspect ratio** from the dropdown: Auto, 16/9, 4/3, 1/1, 9/16, 3/2, 21/9, None, or a custom ratio (e.g. `5/4`).
- **Resize the preview** by dragging the bottom-right corner.
- **Reset to note width** using the reset button.
- Click **OK** to insert or **Cancel** to discard.

For providers that produce non-iframe native markup (e.g. social post widgets), sizing controls are hidden and the modal shows a plain static preview.

---

### Preload options

Controls how embeds behave before the iframe content has fully loaded. Found in **Settings → Preload options**.

| Option | Behaviour |
|---|---|
| None | Embed loads immediately when the note is opened |
| Placeholder | Shows a loading placeholder while the iframe fetches content |
| Placeholder + click to load | Shows a static placeholder; the iframe only loads after the user clicks on it |

The placeholder modes reduce Cumulative Layout Shift (CLS) and avoid network requests for embeds you never scroll to.

---

### Dark mode

Enables dark theme variants for providers that support them. Currently applied to Twitter/X, Reddit, and Deezer. Toggle in **Settings → Dark mode**.

---

### Show original link

Appends an *Open original link* footer below every generated embed so you can always reach the source page directly. Toggle in **Settings → Show original link under embed**.

---

### Save images and media to vault

**Save image embeds to vault** — When enabled, direct image URLs (`.jpg`, `.png`, `.gif`, etc.) are downloaded to your vault and the embed link is replaced with a local vault path.

**Save social media images to vault** — When additionally enabled, the plugin fetches the first available media image from supported social/media platforms and saves it to your vault alongside the embed. The embed URL in the note is preserved; only the image asset is stored locally. For some sites like Instagram, this does not always work.

Platforms supported for social media image extraction:

- Instagram, Facebook, Pinterest, Telegram, Mastodon, Reddit
- TikTok, Imgur, SoundCloud, Spotify, CodePen, Steam

**Image folder path** (default: `linked-iframe-images`) — vault folder for all downloaded image files.

---

### Save Google Docs to vault

When **Save Google Docs to vault** is enabled, embedding a Google Docs URL also downloads a Markdown copy of the document into your vault.

> [!IMPORTANT]
> The document must be shared with *Anyone with the link* for the export to succeed.

**Google Docs folder path** (default: `linked-iframe-docs`) — vault folder for exported Markdown files.

---

## Quizlet vault export

Enabling **Save Quizlet cards to vault** exports the flashcards from any Quizlet set you embed into local Markdown notes. The export runs at embed time and attempts several extraction strategies in sequence to maximise compatibility with Quizlet's varying page formats: REST API, `__NEXT_DATA__` JSON, JSON-LD structured data, script variable patterns, and visible page text.

> [!WARNING]
> This setting can impact general plugin performance. Embedding larger Quizlet sets may cause visible stutter while the export runs.

### Export modes

**Single-file mode** (default) — one Markdown file per set, with all cards listed as term/definition pairs. Good for quick reference.

**Separate notes mode** (toggle **Quizlet: save as separate notes**) — one folder per set and one Markdown note per card. Recommended for use with the [Yanki](obsidian://show-plugin?id=yanki) plugin, which syncs Obsidian notes to Anki.

**Quizlet image mode** (toggle **Quizlet: save card images to vault**) — when enabled, card images are downloaded and embedded locally in exported notes; when disabled, exports keep text-only card content.

### Yanki interoperability

Separate notes mode is designed to work cleanly with Yanki workflows where each note maps to one flashcard.

Why this works well with Yanki:

- One card per file gives Yanki a stable source note instead of parsing multiple cards from one large document.
- `QuizletSetId` + `QuizletCardId` frontmatter gives each note a durable identity, so re-exports update the same note instead of creating duplicates.
- Front/back `quizlet:user-notes` blocks are preserved during updates, so your own edits and mnemonics stay intact after syncing new Quizlet changes.
- Stale cards are marked with `<!-- quizlet:stale=true -->` rather than deleted, so you can decide in Obsidian/Yanki whether to archive, suspend, or keep them.

Recommended workflow with Yanki:

1. Enable **Save Quizlet cards to vault** and **Quizlet: save as separate notes**.
2. Keep exports under a dedicated Quizlet folder (default `linked-iframe-quizlet`) so Yanki can target that path cleanly.
3. Configure Yanki to use term as front and definition as back, while leaving the `quizlet:user-notes` blocks available for personal additions.
4. Use **Update all saved Quizlet cards** when sets change; then run your Yanki sync so only changed notes are propagated.

### Card note structure (separate notes mode)

Each card note is structured as:

````markdown
---
QuizletSetId: "123456789"
QuizletCardId: "987654321"
---

Card term

<!-- quizlet:user-notes:start -->
Your notes for the front of this card
<!-- quizlet:user-notes:end -->

---

Card definition

<!-- quizlet:user-notes:start -->
Your notes for the back of this card
<!-- quizlet:user-notes:end -->

<!-- quizlet:source=https://quizlet.com/... -->
````

Key behaviours:

- `QuizletSetId` and `QuizletCardId` in frontmatter identify existing notes on re-export, so cards are updated in place rather than duplicated.
- The `<!-- quizlet:user-notes:start/end -->` blocks are preserved across all future updates — anything you write inside them is never overwritten. There is one block for the front and one for the back of each card.
- Cards removed from the live Quizlet set are marked `<!-- quizlet:stale=true -->` rather than deleted from your vault.
- If **Quizlet: save card images to vault** is enabled, card images are downloaded to the set's local asset folder and embedded with `![[path]]`.

### Bulk update

The **Update all saved Quizlet cards** button in settings scans your entire vault for `<!-- quizlet:source=... -->` markers, deduplicates by set ID, and re-exports every unique set. A notice reports the result: sets refreshed, saved, updated, unchanged, and any errors.

**Quizlet folder path** (default: `linked-iframe-quizlet`) — vault folder for all Quizlet exports.

---

## Known limitations

**Spotify** — Playback is limited to 30-second previews. Full playback requires a logged-in browser session, which is not possible inside Obsidian.

**Twitter / X** — Only `x.com` URLs are handled by this plugin. Obsidian >= 1.7.0 handles `twitter.com` natively. Both domains point to the same content.

**Mastodon** — The plugin validates the instance domain against the Mastodon API before embedding. Always use the original post URL from the source instance (e.g. `mastodon.social/@user/1234`), not a cross-instance copy.

**Reddit** — Reddit short share links (`/s/...`) cannot be embedded directly. Open the link in a browser first — Reddit will redirect to the full `/comments/...` URL which the plugin handles correctly.

**Quizlet** — Card data is only accessible for public sets. Private or password-protected sets cannot be exported.

**Google Docs** — The Markdown vault export only works if the document is shared with *Anyone with the link*.

---

## FAQ

**The embed isn't appearing.**

1. Have you [enabled the plugin](https://help.obsidian.md/Extending+Obsidian/Community+plugins#Enable+a+community+plugin)?
2. Did you select a URL and use the context menu or command? The plugin inserts HTML directly — pasting a raw URL alone does not create an embed.
3. If the problem persists, [open a GitHub issue](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues/new) with the URL and a description of what you see.

**The Quizlet export produced no cards.**

Confirm the set is public by opening the URL in a browser. If it is public and the export still fails, [open an issue](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues/new) with the set URL.

**A website I use is not supported.**

[Open a feature request](https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues/new). Until it is added, the plugin will embed the full page as a generic iframe.

---

## Credits

- Built on GnoxNahte's [obsidian-auto-embed](https://github.com/GnoxNahte/obsidian-auto-embed), which was itself inspired by Sam Warnick's archived [Simple Embed](https://github.com/samwarnick/obsidian-simple-embeds).
- New architecture and provider class system draws from FHachez's [obsidian-convert-url-to-iframe](https://github.com/FHachez/obsidian-convert-url-to-iframe).
- Save-to-vault concepts inspired by Seraphli's [obsidian-link-embed](https://github.com/Seraphli/obsidian-link-embed).
