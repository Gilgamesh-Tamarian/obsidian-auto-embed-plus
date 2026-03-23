# Settings
This is an explanation of all the settings that the plugin has.

## General

### Preview embed
Opens a modal where you can test an embed URL before inserting it into a note.

### Dark mode
Uses dark theme variants for providers that support theme switching, namely Reddit and Twitter/X.

### Preload options
Controls how embeds behave before they fully load:

- None: Load embeds immediately.
- Placeholder: Show a loading placeholder first.
- Placeholder + click to load: Show a placeholder and only load the embed after click.

### Show original link under embed
Adds an Open original link footer below generated embeds. This does not change the behaviour for existing embeds.

## Download and storage

These settings appear directly in the main settings list (not inside a collapsible section). They allow you to store certain media from embedded URLs locally, which can impact performance and vault size.

### Save image embeds to vault
Downloads direct image URLs to your vault and replaces links with local files.

### Save social media images to vault
For supported social/media providers, tries to fetch the first available image and save it locally.

Currently supported for this extraction flow:

- Instagram
- Facebook
- Pinterest
- Telegram
- Mastodon
- Reddit
- TikTok
- Imgur
- SoundCloud
- Spotify
- CodePen
- Steam

### Save Google Docs to vault
When embedding a Google Doc, attempts to download a Markdown copy into your vault.

Important:

- The Google Doc must be shared so it can be accessed by link.

### Image folder path
Target folder inside your vault for downloaded image files. Case sensitive.

Default: linked-iframe-images

### Google Docs folder path
Target folder inside your vault for downloaded Google Docs Markdown files. Case sensitive.

Default: linked-iframe-docs

## Quizlet

Quizlet settings are grouped inside the **Quizlet** collapsible section in the settings tab.

### Save Quizlet cards to vault
Performs a best-effort export of public Quizlet flashcards into local Markdown notes.

Important:

- This setting can impact performance.
- Larger Quizlet sets may cause visible stutter while embedding/exporting.

### Quizlet: save as separate notes
Changes Quizlet export format:

- Enabled: One folder per set and one Markdown note per card. This is useful for Yanki-style workflows.
- Disabled: One Markdown file per Quizlet set (legacy-style export).

### Quizlet: save card images to vault
Controls whether image media from Quizlet cards is downloaded and embedded locally in exported notes.

- Enabled: Card images are downloaded to vault and embedded as local files.
- Disabled: Quizlet exports are text-only (no localized card images).

### Quizlet folder path
Target folder inside your vault for Quizlet exports. You can rearrange/rename the subfolders and cards, but DO NOT disjointly rearrange cards (will result in duplicates). Case sensitive.

Default: linked-iframe-quizlet

### Update all saved Quizlet cards
Runs a bulk refresh for Quizlet sets that already have a stored quizlet:source marker in your vault. Keeps existing tags and notes, to ensure continuity.

This action shows a summary with counts for:

- refreshed sets
- saved
- updated
- unchanged
- no-cards
- not-html
- errors

## Supported embed providers

Current supported website list in settings:

- Twitter/X
- Imgur
- Reddit
- CodePen
- Google Docs
- Google Drive
- Google Calendar
- Google Maps
- Wikipedia
- Geogebra
- Quizlet
- OpenStreetMap
- SoundCloud
- Spotify
- Apple Music
- Tidal
- Deezer
- Steam
- YouTube
- Vimeo
- Dailymotion
- VK Video
- Twitch
- TikTok
- Instagram
- Facebook
- Pinterest
- Telegram
- Mastodon
- Threads