import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: YouTube, Vimeo, Dailymotion, VK Video, Twitch.

export class YouTubeEmbed extends EmbedBase {
    name: SupportedWebsites = "YouTube";
    // Supports common YouTube formats:
    // - youtube.com/watch?v=...
    // - youtu.be/...
    // - youtube.com/shorts/... , /live/... , /embed/...
    regex = new RegExp(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i);

    private getVideoId(url: string): string | null {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");

        if (host === "youtu.be") {
            const id = parsed.pathname.split("/").filter(Boolean)[0];
            return id && id.length >= 11 ? id : null;
        }

        const v = parsed.searchParams.get("v");
        if (v && v.length >= 11) {
            return v;
        }

        const parts = parsed.pathname.split("/").filter(Boolean);
        const embedIdx = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part));
        if (embedIdx !== -1 && parts[embedIdx + 1]) {
            const id = parts[embedIdx + 1];
            return id.length >= 11 ? id : null;
        }

        return null;
    }

    private parseStartSeconds(url: string): number | null {
        const parsed = new URL(url);
        const raw = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");

        if (!raw) {
            return null;
        }

        // Accept forms like "90", "90s", "1m30s", "1h2m3s".
        if (/^\d+$/.test(raw)) {
            return Number(raw);
        }

        const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
        if (!match) {
            return null;
        }

        const h = Number(match[1] ?? 0);
        const m = Number(match[2] ?? 0);
        const s = Number(match[3] ?? 0);
        const total = h * 3600 + m * 60 + s;

        return total > 0 ? total : null;
    }

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const videoId = this.getVideoId(url);
        if (!videoId) {
            return this.onErrorCreatingEmbed(url, "Cannot find video id.");
        }

        const isShort = /\/shorts\//.test(url);
        const start = this.parseStartSeconds(url);

        let embedUrl = `https://www.youtube.com/embed/${videoId}`;
        if (start !== null) {
            embedUrl += `?start=${start}`;
        }

        const iframe = this.createEmbedIframe({
            src: embedUrl,
            containerClass: isShort ? "youtube-shorts-embed" : "youtube-embed",
            allowFullscreen: true,
            allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
            sandbox: ["allow-forms", "allow-presentation", "allow-same-origin", "allow-scripts", "allow-popups"],
            cacheKey: videoId,
        });

        return iframe;
    }
}

export class VimeoEmbed extends EmbedBase {
    name: SupportedWebsites = "Vimeo";
    regex = new RegExp(/https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const videoId = regexMatch[1];

        const iframe = this.createEmbedIframe({
            src: `https://player.vimeo.com/video/${videoId}`,
            containerClass: "vimeo-embed",
            allowFullscreen: true,
            allow: "autoplay; fullscreen; picture-in-picture",
            cacheKey: videoId,
        });

        return iframe;
    }
}

export class DailymotionEmbed extends EmbedBase {
    name: SupportedWebsites = "Dailymotion";
    regex = new RegExp(/https?:\/\/(?:www\.)?dailymotion\.com\/video\/([\w]+)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const videoId = regexMatch[1];

        const iframe = this.createEmbedIframe({
            src: `https://www.dailymotion.com/embed/video/${videoId}`,
            containerClass: "dailymotion-embed",
            allowFullscreen: true,
            allow: "autoplay; fullscreen; picture-in-picture",
            cacheKey: videoId,
        });

        return iframe;
    }
}

export class VKVideoEmbed extends EmbedBase {
    name: SupportedWebsites = "VK Video";
    regex = new RegExp(/https?:\/\/(?:www\.)?vk\.com\/video(-?\d+_\d+)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const videoId = regexMatch[1];

        const iframe = this.createEmbedIframe({
            src: `https://vk.com/video_ext.php?oid=${videoId.split("_")[0]}&id=${videoId.split("_")[1]}`,
            containerClass: "vk-video-embed",
            allowFullscreen: true,
            allow: "autoplay; encrypted-media",
            cacheKey: videoId,
        });

        return iframe;
    }
}

export class TwitchEmbed extends EmbedBase {
    name: SupportedWebsites = "Twitch";
    // Matches: channel streams, clips, and VODs
    // - https://www.twitch.tv/{channel}
    // - https://www.twitch.tv/{channel}/clip/{id}
    // - https://www.twitch.tv/videos/{id}
    regex = new RegExp(/https?:\/\/(?:www\.)?twitch\.tv\/(videos\/\d+|[\w-]+(?:\/clip\/[\w-]+)?)/i);

    createEmbed(url: string): HTMLElement {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();

        let embedUrl: string;
        let cacheKey: string;

        // Check for VOD (Video on Demand)
        const vodMatch = pathname.match(/\/videos\/(\d+)/);
        if (vodMatch) {
            const videoId = vodMatch[1];
            embedUrl = `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}`;
            cacheKey = videoId;
        } else if (pathname.includes("/clip/")) {
            // Clip URL
            const clipMatch = pathname.match(/\/[\w-]+\/clip\/([\w-]+)/);
            if (clipMatch) {
                const clipId = clipMatch[1];
                embedUrl = `https://clips.twitch.tv/embed?clip=${clipId}&parent=${window.location.hostname}`;
                cacheKey = clipId;
            } else {
                return this.onErrorCreatingEmbed(url, "Cannot parse clip ID");
            }
        } else {
            // Channel/user URL
            const channelMatch = pathname.match(/\/([\w-]+)$/);
            if (channelMatch) {
                const channel = channelMatch[1];
                embedUrl = `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`;
                cacheKey = channel;
            } else {
                return this.onErrorCreatingEmbed(url, "Cannot parse channel name");
            }
        }

        const iframe = this.createEmbedIframe({
            src: embedUrl,
            containerClass: "twitch-embed",
            allowFullscreen: true,
            allow: "autoplay; encrypted-media",
            cacheKey: cacheKey,
        });

        return iframe;
    }
} 