import { requestUrl } from "obsidian";
import { setCssProps } from "../utility";
import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: Twitter/X, Mastodon, Threads.

export class TwitterEmbed extends EmbedBase {
    name: SupportedWebsites = "Twitter/X";
    // Don't parse twitter since Obsidian already handles that.
    regex = new RegExp(/https:\/\/(?:x)\.com\/(\w+)(?:\/status\/(\w+))?/);
    embedOrigin = "https://platform.twitter.com";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        // Shouldn't happen since got test before. But in case
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const postId = regexMatch[2];
        const isPost = postId !== undefined;

        // Embed post
        if (isPost)
            url = `https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=${this.plugin.settings.darkMode ? "dark" : "light"}&id=${regexMatch[2]}`;
        // Embed profile timeline
        else
            url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${regexMatch[1]}?dnt=true`;

        const iframe = this.createEmbedIframe({
            src: url,
            containerClass: "twitter-embed",
            dataset: { twitterPostId: postId },
            sandbox: ["allow-forms", "allow-presentation", "allow-same-origin", "allow-scripts", "allow-modals", "allow-popups"],
            scrolling: isPost ? "no" : undefined,
            cacheKey: postId,
        });

        return iframe;
    }

    onResizeMessage(e: MessageEvent): void {
        if (e.data["twttr.embed"]["method"] !== "twttr.private.resize")
            return;

        const params = e.data["twttr.embed"]["params"][0];
        const postId = params["data"]["tweet_id"];

        const iframes = document.querySelectorAll(`.twitter-embed iframe[data-twitter-post-id="${postId}"]`);

        if (iframes.length === 0)
            return;

        for (let i = 0; i < iframes.length; ++i) {
            const iframe = iframes[i] as HTMLIFrameElement;

            const height = (params["height"] as number) + 1;
            setCssProps(iframe, { height: height + "px" });

            this.resizeContainer(iframe, iframe.style.height);

            if (postId)
                this.cacheSize(postId, height);
        }
    }
}

export class MastodonEmbed extends EmbedBase {

    private static readonly DEFAULT_HEIGHT = "750px";

    name: SupportedWebsites = "Mastodon";

    regex = new RegExp(
        /https:\/\/([^/?#]+)\/(?:@([A-Za-z0-9_.-]+)\/(\d+)|users\/[A-Za-z0-9_.-]+\/statuses\/(\d+))(?:\/)?(?:[?#].*)?$/i
    );

    embedOrigin = "";

    private instanceValidationCache: Record<string, boolean> = {};

    async validateUrl(url: string): Promise<boolean> {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return false;

        const instance = regexMatch[1];
        if (!instance)
            return false;

        if (instance in this.instanceValidationCache)
            return this.instanceValidationCache[instance];

        const apiCandidates = [
            `https://${instance}/api/v2/instance`,
            `https://${instance}/api/v1/instance`,
        ];

        for (const apiUrl of apiCandidates) {
            try {
                const response = await requestUrl({ url: apiUrl, method: "GET" });
                const contentType = response.headers["content-type"] ?? "";
                const data = response.json as Record<string, unknown> | null;

                if (contentType.includes("application/json") && data && ("uri" in data || "title" in data)) {
                    this.instanceValidationCache[instance] = true;
                    return true;
                }
            } catch {
                continue;
            }
        }

        this.instanceValidationCache[instance] = false;
        return false;
    }

    createEmbed(url: string): HTMLElement {

        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const instance = regexMatch[1];
        const username = regexMatch[2] || regexMatch[4];
        const postId = regexMatch[3] || regexMatch[5];

        if (!instance || !username || !postId)
            return this.onErrorCreatingEmbed(url, "Invalid Mastodon link format.");

        const embedUrl = `https://${instance}/@${username}/${postId}/embed`;

        const iframe = this.createEmbedIframe({
            src: embedUrl,
            containerClass: "mastodon-embed",
            dataset: {
                mastodonInstance: instance,
                mastodonPostId: postId,
            },
            sandbox: [
                "allow-forms",
                "allow-presentation",
                "allow-same-origin",
                "allow-scripts",
                "allow-modals",
                "allow-popups",
            ],
            scrolling: "auto",
            allowFullscreen: true,
            styles: {
                overflow: "auto",
                width: "100%",
                border: "0",
                height: MastodonEmbed.DEFAULT_HEIGHT,
            },
            cacheKey: postId,
        });

        iframe.setAttribute("allowtransparency", "true");

        return iframe;
    }

    onResizeMessage(e: MessageEvent): void {

        if (!e.data)
            return;

        if (!e.data.height)
            return;

        const height = (e.data.height as number) + 1;

        const iframes = document.querySelectorAll(
            `.mastodon-embed iframe`
        );

        if (iframes.length === 0)
            return;

        for (let i = 0; i < iframes.length; ++i) {
            const iframe = iframes[i] as HTMLIFrameElement;
            setCssProps(iframe, { height: height + "px" });
            this.resizeContainer(iframe, iframe.style.height);
            if (iframe.parentElement) {
                setCssProps(iframe.parentElement, { height: iframe.style.height });
            }
            const postId = iframe.dataset.mastodonPostId;
            if (postId)
                this.cacheSize(postId, height);
        }
    }
}

export class ThreadsEmbed extends EmbedBase {
    name: SupportedWebsites = "Threads";
    regex = new RegExp(
        /https:\/\/(?:www\.)?threads\.(?:net|com)\/@([A-Za-z0-9_.]+)\/post\/([A-Za-z0-9_-]+)/,
    );

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null) {
            return this.onErrorCreatingEmbed(url);
        }

        const username = regexMatch[1];
        const postId = regexMatch[2];

        const iframe = this.createEmbedIframe({
            src: `https://www.threads.net/@${encodeURIComponent(username)}/post/${encodeURIComponent(postId)}/embed`,
            containerClass: "threads-embed",
            dataset: { threadsPostId: postId },
            sandbox: [
                "allow-forms",
                "allow-presentation",
                "allow-same-origin",
                "allow-scripts",
                "allow-modals",
                "allow-popups",
            ],
            scrolling: "no",
            styles: {
                width: "100%",
                border: "0",
                minHeight: "360px",
                height: "560px",
            },
            cacheKey: postId,
        });

        return iframe;
    }
}
