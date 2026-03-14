import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

export class MastodonEmbed extends EmbedBase {

    name: SupportedWebsites = "Mastodon";

    /*
    Generic Mastodon URL pattern.

    Examples:
    https://mastodon.social/@user/109382938239
    https://fosstodon.org/@someone/111234234
    */
    regex = new RegExp(/https:\/\/([^\/]+)\/@([\w\d_]+)\/(\d+)/);

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
        const username = regexMatch[2];
        const postId = regexMatch[3];

        /*
        Only allow instances specified by the user
        */
        if (!this.plugin.settings.mastodonInstances.includes(instance))
            return this.onErrorCreatingEmbed(url);

        const iframe = createEl("iframe");

        const embedUrl =
            `https://${instance}/@${username}/${postId}/embed`;

        iframe.src = embedUrl;

        iframe.classList.add(this.autoEmbedCssClass);
        iframe.dataset.containerClass = "mastodon-embed";

        iframe.dataset.mastodonInstance = instance;
        iframe.dataset.mastodonPostId = postId;

        iframe.sandbox.add(
            "allow-forms",
            "allow-presentation",
            "allow-same-origin",
            "allow-scripts",
            "allow-modals",
            "allow-popups"
        );

        iframe.setAttribute("scrolling", "no");

        iframe.style.width = "100%";
        iframe.style.border = "0";

        /*
        Default height before resize message
        */
        iframe.style.height = "500px";

        /*
        Restore cached size if known
        */
        if (this.sizeCache[postId] && this.sizeCache[postId].height) {
            iframe.style.height = this.sizeCache[postId].height + "px";
        }

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

            iframe.style.height = height + "px";

            this.resizeContainer(iframe, iframe.style.height);

            const postId = iframe.dataset.mastodonPostId;

            if (postId)
                this.sizeCache[postId] = {
                    width: 0,
                    height: height
                };
        }
    }
}
