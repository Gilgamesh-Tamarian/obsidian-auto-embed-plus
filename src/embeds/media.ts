import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: Spotify, Apple Music, Tidal, Deezer, SoundCloud.

export class SpotifyEmbed extends EmbedBase {
    name: SupportedWebsites = "Spotify";
    regex = new RegExp(/https:\/\/(?:open|play|www)\.spotify\.com\/(\w+)\/(\w+)(?:\?highlight=spotify:track:(\w+))?/);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const container = createDiv();
        container.classList.add(this.autoEmbedCssClass);
        container.dataset.containerClass = "spotify-embed-container";
        if (regexMatch[1] === "playlist" || regexMatch[1] === "album" || regexMatch[1] === "artist")
            container.classList.add("spotify-playlist-embed");

        this.createEmbedIframe({
            src: `https://open.spotify.com/embed/${regexMatch[1]}/${regexMatch[2]}?utm_source=oembed` +
                (regexMatch[3] !== undefined ? ("&highlight=spotify:track:" + regexMatch[3]) : ""),
            parent: container,
            allowFullscreen: true,
            allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
        });

        return container;
    }
}

export class AppleMusicEmbed extends EmbedBase {
    name: SupportedWebsites = "Apple Music";
    // Matches /locale/type/ where locale is 2-5 letters optionally followed by -xx (e.g. zh-cn, pt-br)
    regex = new RegExp(/https:\/\/music\.apple\.com\/([a-z]{2,5}(?:-[a-z]{2})?)\/([a-z-]+)\//i);
    embedOrigin = "https://embed.music.apple.com";

    createEmbed(url: string): HTMLElement {
        let embedUrl: string;
        let embedType = "album";
        let isSingleSong = false;

        try {
            const parsed = new URL(url);
            if (!this.regex.test(url))
                return this.onErrorCreatingEmbed(url);

            // Extract locale and type from the path
            const pathMatch = parsed.pathname.match(
                /^\/([a-z]{2,5}(?:-[a-z]{2})?)\/([a-z-]+)\/(?:[^/]+\/)?(\d+|pl\.[a-zA-Z0-9_-]+)\/?$/i
            );
            if (!pathMatch)
                return this.onErrorCreatingEmbed(url);

            const [, locale, type, id] = pathMatch;
            embedType = type.toLowerCase();

            // Build clean embed URL using only locale/type/id (no slug)
            // This avoids issues with percent-encoded or non-ASCII characters in the slug
            const cleanUrl = new URL(`https://embed.music.apple.com/${locale}/${type}/${id}`);

            // Preserve ?i= (specific song track within an album)
            const trackId = parsed.searchParams.get("i");
            if (trackId) {
                cleanUrl.searchParams.set("i", trackId);
                isSingleSong = true;
            }

            embedUrl = cleanUrl.toString();
        } catch {
            return this.onErrorCreatingEmbed(url);
        }

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "apple-music-embed",
            classNames: [
                embedType === "playlist" ? "apple-music-playlist-embed" : "",
                isSingleSong ? "apple-music-song-embed" : "",
            ].filter(Boolean),
            allow: "autoplay *; encrypted-media *; fullscreen *; clipboard-write",
            allowFullscreen: true,
        });
    }
}

export class TidalEmbed extends EmbedBase {
    name: SupportedWebsites = "Tidal";
    regex = new RegExp(/https:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?(album|track|playlist|video)\/([A-Za-z0-9-]+)/i);
    embedOrigin = "https://embed.tidal.com";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const type = regexMatch[1].toLowerCase();
        const id = regexMatch[2];
        const embedTypeMap: Record<string, string> = {
            album: "albums",
            track: "tracks",
            playlist: "playlists",
            video: "videos",
        };

        const embedType = embedTypeMap[type];
        if (!embedType)

            return this.onErrorCreatingEmbed(url);

        return this.createEmbedIframe({
            src: `https://embed.tidal.com/${embedType}/${id}`,
            containerClass: "tidal-embed",
            classNames: [type === "track" ? "tidal-track-embed" : ""].filter(Boolean),
            allow: "autoplay; encrypted-media; clipboard-write",
            allowFullscreen: true,
        });
    }
}

export class DeezerEmbed extends EmbedBase {
    name: SupportedWebsites = "Deezer";
    regex = new RegExp(/https:\/\/(?:www\.|open\.)?deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist|artist)\/(\d+)/i);
    embedOrigin = "https://widget.deezer.com";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const type = regexMatch[1].toLowerCase();
        const id = regexMatch[2];
        const theme = this.plugin.settings.darkMode ? "dark" : "light";

        return this.createEmbedIframe({
            src: `https://widget.deezer.com/widget/${theme}/${type}/${id}`,
            containerClass: "deezer-embed",
            classNames: [type === "track" ? "deezer-track-embed" : ""].filter(Boolean),
            allow: "autoplay; encrypted-media; clipboard-write",
            allowFullscreen: true,
        });
    }
}

export class SoundCloudEmbed extends EmbedBase {
    name: SupportedWebsites = "SoundCloud";
    regex = new RegExp(/https:\/\/(?:www\.)?soundcloud\.com\/(.*)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        return this.createEmbedIframe({
            src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${regexMatch[1]}`)}`,
            containerClass: "soundcloud-embed",
        });
    }
}
