import { setCssProps } from "../utility";
import { SupportedWebsites } from "src/settings-tab";
import { BaseEmbedData, EmbedBase } from "./embedBase";
import { requestUrl } from "obsidian";

export class DefaultFallbackEmbed extends EmbedBase {
    private static readonly DEFAULT_WIDTH = "100%";
    private static readonly DEFAULT_HEIGHT = "500px";
    private static readonly DEFAULT_LINK_TEXT = "Link";

    name: SupportedWebsites | "Fallback" = "Fallback";
    regex = new RegExp(/ /); // Not using regex for this

    createEmbed(url: string, embedOptions: BaseEmbedData): HTMLElement {
        const embedContainer = createSpan();
        embedContainer.addClass(this.autoEmbedCssClass, "default-fallback-embed-container");

        const iframe = createEl("iframe");
        iframe.src = url;
        iframe.classList.add(this.autoEmbedCssClass);
        iframe.dataset.containerClass = "default-fallback-embed";

        setCssProps(embedContainer, {
            width: embedOptions.width ?? DefaultFallbackEmbed.DEFAULT_WIDTH,
            height: embedOptions.height ?? DefaultFallbackEmbed.DEFAULT_HEIGHT,
        });

        embedContainer.appendChild(iframe);

        if (embedOptions.alt) {
            const link = createEl("a", { href: url, text: embedOptions.alt.trim() });
            embedContainer.appendChild(link);
            return embedContainer;
        }

        const link = createEl("a", { href: url, text: "Loading title..." });
        this.linkTitle(url)
            .then(title => link.text = title)
            .catch(() => link.text = url);
        embedContainer.appendChild(link);

        return embedContainer;
    }

    async linkTitle(url: string) {
        try {
            const response = await requestUrl({url: url, method: "GET"});

            if (!response.headers["content-type"].includes("text/html"))
                return DefaultFallbackEmbed.DEFAULT_LINK_TEXT;

            const html = response.text;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const title = doc.querySelector('title');

            if (title && title.text) {
                return title.text;
            }
            else {
                return DefaultFallbackEmbed.DEFAULT_LINK_TEXT;
            }
        } catch (ex) {
            return `Error: ${ex.message}`;
        }
    }
}
