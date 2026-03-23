import { setCssProps } from "../utility";
import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: Reddit, Instagram, TikTok, Facebook, Pinterest, Telegram.

export class RedditEmbed extends EmbedBase {
    name: SupportedWebsites = "Reddit";
    regex = new RegExp(/reddit.com/);
    embedOrigin = "https://embed.reddit.com";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const postIdRegexResult = url.match(/\/(?:comments|s)\/(\w+)/) as RegExpMatchArray;
        if (!postIdRegexResult) {
            return this.onErrorCreatingEmbed(url, "Cannot find post id.");
        }

        const postId = postIdRegexResult[1];

        url = url.replace("www.reddit.com", "embed.reddit.com");

        if (this.plugin.settings.darkMode) {
            url += (url.contains('?') ? "&" : "?") + "theme=dark";
        }

        const iframe = this.createEmbedIframe({
            src: url,
            containerClass: "reddit-embed",
            classNames: [`reddit-${postId[1]}`],
            dataset: { redditPostId: postId },
            scrolling: "no",
            allowFullscreen: true,
            cacheKey: postId,
        });

        return iframe;
    }

    onResizeMessage(e: MessageEvent) {
        let data;
        try {
            data = JSON.parse(e.data);
        } catch (error) {
            console.error("Error parsing reddit message. Error: " + error);
            return;
        }

        if (data.type !== "resize.embed") {
            console.warn("Reddit unknown message: " + data.type);
            return;
        }

        const iframes = document.querySelectorAll(".reddit-embed > iframe");
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i] as HTMLIFrameElement;
            if (iframe.contentWindow == e.source) {
                const height = data.data;
                setCssProps(iframe, { height: height + "px" });

                this.resizeContainer(iframe, iframe.style.height);

                const postId = iframe.dataset.redditPostId;
                if (postId)
                    this.cacheSize(postId, height);

                break;
            }
        }
    }
}

export class InstagramEmbed extends EmbedBase {
    name: SupportedWebsites = "Instagram";
    regex = new RegExp(/https:\/\/(?:www\.)?instagram\.com\/(?:(?:(?:[\w._(?:[\w._]+\/)?(?:p|reel)\/([\w\-_]+))|(?:[\w._(?:[\w._]+))/);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const isProfile = regexMatch[1] === undefined;
        let src: string;
        const classNames: string[] = [];

        if (isProfile) {
            const profileMatch = url.match(/https:\/\/(?:www\.)?instagram\.com\/([\w._(?:[\w._]+)/);
            if (profileMatch === null)
                return this.onErrorCreatingEmbed(url);

            src = `https://instagram.com/${profileMatch[1]}/embed/`;
            classNames.push("instagram-profile");
        }
        else {
            src = `https://instagram.com/reel/${regexMatch[1]}/embed/`;
        }

        const iframe = this.createEmbedIframe({
            src,
            containerClass: "instagram-embed",
            classNames,
            scrolling: "no",
        });

        function resizeEmbed() {
            if (isProfile) {
                setCssProps(iframe, { height: (0.7 * iframe.offsetWidth + 200) + "px" });
            }
            else {
                setCssProps(iframe, { height: (1.25 * iframe.offsetWidth + 208) + "px" });
            }
        }

        resizeEmbed();
        new ResizeObserver(resizeEmbed).observe(iframe);
        return iframe;
    }
}

export class TikTokEmbed extends EmbedBase {
    name: SupportedWebsites = "TikTok";
    embedOrigin = "https://www.tiktok.com";
    regex = new RegExp(/https:\/\/www\.tiktok\.com\/@([\w.]+)\/video\/(\d+)/);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const tiktokId = regexMatch[2];

        const iframe = this.createEmbedIframe({
            src: `https://www.tiktok.com/embed/v2/${tiktokId}/`,
            containerClass: "tiktok-embed",
            dataset: { tiktokId },
            allowFullscreen: true,
            cacheKey: tiktokId,
        });

        return iframe;
    }

    onResizeMessage(e: MessageEvent): void {
        if (e.data === "[tea-sdk]ready")
            return;

        let data;
        try {
            data = JSON.parse(e.data);
        } catch (error) {
            console.error("Cannot parse tiktok json:\n" + error);
            return;
        }

        const height = data.height;
        if (!height)
            return;

        const iframes = document.querySelectorAll(`.tiktok-embed iframe`);
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i] as HTMLIFrameElement;
            if (iframe.contentWindow == e.source) {
                setCssProps(iframe, { height: data.height + "px" });

                this.resizeContainer(iframe, iframe.style.height);

                const tiktokId = iframe.dataset.tiktokId;
                if (tiktokId)
                    this.cacheSize(tiktokId, height);

                break;
            }
        }
    }
}

export class FacebookEmbed extends EmbedBase {
    name: SupportedWebsites = "Facebook";
    regex = new RegExp(/https:\/\/(?:www\.)?facebook\.com\//i);

    createEmbed(url: string): HTMLElement {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return this.onErrorCreatingEmbed(url);
        }

        const isVideoUrl =
            /\/videos\//i.test(parsed.pathname) ||
            /\/watch\//i.test(parsed.pathname) ||
            !!parsed.searchParams.get("v");

        const pluginPath = isVideoUrl ? "video.php" : "post.php";
        const embedUrl = `https://www.facebook.com/plugins/${pluginPath}?href=${encodeURIComponent(url)}&show_text=true&width=500`;

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "facebook-embed",
            allow: "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
            allowFullscreen: true,
        });
    }
}

export class PinterestEmbed extends EmbedBase {
    name: SupportedWebsites = "Pinterest";
    regex = new RegExp(/https:\/\/(?:[a-z]{2}\.)?(?:www\.)?pinterest\.[a-z.]+\/pin\/(\d+)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url, "Only Pinterest pin URLs are currently supported.");

        const pinId = regexMatch[1];

        return this.createEmbedIframe({
            src: `https://assets.pinterest.com/ext/embed.html?id=${pinId}`,
            containerClass: "pinterest-embed",
            scrolling: "no",
            cacheKey: pinId,
        });
    }
}

export class TelegramEmbed extends EmbedBase {
    name: SupportedWebsites = "Telegram";
    regex = new RegExp(/https:\/\/(?:t(?:elegram)?\.me)\//i);

    createEmbed(url: string): HTMLElement {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return this.onErrorCreatingEmbed(url);
        }

        const host = parsed.hostname.toLowerCase();
        if (host !== "t.me" && host !== "telegram.me")
            return this.onErrorCreatingEmbed(url);

        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const offset = pathParts[0] === "s" ? 1 : 0;
        const channel = pathParts[offset];
        const postId = pathParts[offset + 1];

        if (!channel || !postId || !/^\d+$/.test(postId))
            return this.onErrorCreatingEmbed(url, "Only public Telegram post links are supported.");

        const embedUrl = new URL(`https://t.me/${channel}/${postId}`);
        embedUrl.searchParams.set("embed", "1");
        embedUrl.searchParams.set("mode", "tme");

        return this.createEmbedIframe({
            src: embedUrl.toString(),
            containerClass: "telegram-embed",
            scrolling: "no",
            cacheKey: `${channel}/${postId}`,
        });
    }
}
