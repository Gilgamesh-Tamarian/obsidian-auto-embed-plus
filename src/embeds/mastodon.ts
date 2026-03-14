import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";
import { setCssProps } from "../utility";

export class MastodonEmbed extends EmbedBase {

    name: SupportedWebsites = "Mastodon";

    /*
    Improved Mastodon URL pattern.
    Examples:
    https://mastodon.social/@user/109382938239
    https://fosstodon.org/@someone/111234234
    https://mastodon.social/users/user/statuses/109382938239
    */
    regex = new RegExp(
        /https:\/\/([^\/]+)\/(?:@([A-Za-z0-9_.-]+)\/(\d+)|users\/([A-Za-z0-9_.-]+)\/statuses\/(\d+))/
    );


    /*
    Mastodon instances vary so we cannot use a single embed origin.
    Resize events will be handled without strict origin filtering.
    */
    embedOrigin = "";

    createEmbed(url: string): HTMLElement {

        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const instance = regexMatch[1];
        // Support both @username/postId and users/username/statuses/postId
        const username = regexMatch[2] || regexMatch[4];
        const postId = regexMatch[3] || regexMatch[5];

        // Validate extracted values
        if (!instance || !username || !postId)
            return this.onErrorCreatingEmbed(url, "Invalid Mastodon link format.");

        /*
        Allow instances specified by the user or always-allowed instances
        */
        const alwaysAllowedInstances = [
            "mastodon.social",
            "social.vivaldi.net"
        ];
        const allowed =
            this.plugin.settings.mastodonInstances.some(i =>
                instance === i || instance.endsWith("." + i)
            ) ||
            alwaysAllowedInstances.some(i =>
                instance === i || instance.endsWith("." + i)
            );

        if (!allowed)
            return this.onErrorCreatingEmbed(url);


        const iframe = createEl("iframe");

        const embedUrl = `https://${instance}/@${username}/${postId}/embed`;

        iframe.src = embedUrl;

        iframe.classList.add(this.autoEmbedCssClass);
        iframe.dataset.containerClass = "mastodon-embed";

        iframe.dataset.mastodonInstance = instance;
        iframe.dataset.mastodonPostId = postId;

        // Restore sandbox for security and compatibility
        iframe.sandbox.add(
            "allow-forms",
            "allow-presentation",
            "allow-same-origin",
            "allow-scripts",
            "allow-modals",
            "allow-popups"
        );


        // Allow scrolling
        iframe.setAttribute("scrolling", "auto");
        setCssProps(iframe, {
            overflow: "auto",
            width: "100%",
            border: "0"
        });

        // Set default height for Mastodon embeds from user settings
        const defaultHeight = this.plugin.settings.mastodonDefaultHeight || "750";
        setCssProps(iframe, {
            height: defaultHeight.endsWith("px") ? defaultHeight : `${defaultHeight}px`
        });

        // Restore cached size if known
        if (this.sizeCache[postId] && this.sizeCache[postId].height) {
            setCssProps(iframe, {
                height: this.sizeCache[postId].height + "px"
            });
        }

        // Add allowfullscreen and allowtransparency
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("allowtransparency", "true");

        return iframe;
    }

    /*
    Mastodon sends resize messages via postMessage.
    */
    onResizeMessage(e: MessageEvent): void {

        if (!e.data)
            return;

        /*
        Mastodon resize message format:
        { height: number }
        */
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
                // Also resize the container to match the iframe height
                this.resizeContainer(iframe, iframe.style.height);
                if (iframe.parentElement) {
                    setCssProps(iframe.parentElement, { height: iframe.style.height });
                }
                const postId = iframe.dataset.mastodonPostId;
                if (postId)
                    this.sizeCache[postId] = {
                        width: 0,
                        height: height
                    };
            }
    }
}
