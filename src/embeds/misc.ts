import { setCssProps } from "../utility";
import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";
import { parseQuizletSetId } from "src/utils/url.utils";

// Sites in this file: Imgur, Steam, Google Calendar, Wikipedia, Geogebra, Quizlet.

export class ImgurEmbed extends EmbedBase {
    name: SupportedWebsites = "Imgur";
    regex = new RegExp(/https:\/\/imgur\.com\/(?:(?:a|gallery|(?:t\/\w+))\/)?(\w+)/);
    embedOrigin = "https://imgur.com";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const imgurId = regexMatch[1];

        const iframe = this.createEmbedIframe({
            src: `https://imgur.com/a/${imgurId}/embed?pub=true`,
            containerClass: "imgur-embed",
            dataset: { imgurId },
            scrolling: "no",
            cacheKey: imgurId,
            cacheWidth: true,
        });

        return iframe;
    }

    onResizeMessage(e: MessageEvent) {
        const data = JSON.parse(e.data);
        const href = data.href as string;
        const regexMatch = href.match(/https:\/\/imgur\.com\/(?:a\/)?(\w+)/);

        if (!regexMatch || regexMatch.length < 2)
            return;

        const imgurId = regexMatch[1];
        const iframes = document.querySelectorAll(`.imgur-embed iframe[data-imgur-id="${imgurId}"`);

        if (iframes.length === 0)
            return;

        for (let i = 0; i < iframes.length; ++i) {
            const iframe = iframes[i] as HTMLIFrameElement;

            if (data.message === "resize_imgur") {
                setCssProps(iframe, { height: data.height + "px" });
                setCssProps(iframe, { width: data.width + "px" });

                this.resizeContainer(iframe, iframe.style.height, iframe.style.width);

                this.cacheSize(imgurId, data.height, data.width);
            }
            else if (data.message === "404_imgur_embed") {
                iframe.src = iframe.src.replace("/a/", "/");
            }
        }
    }
}

export class SteamEmbed extends EmbedBase {
    name: SupportedWebsites = "Steam";
    regex = new RegExp(/https:\/\/store\.steampowered\.com\/app\/(\d+)/);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        return this.createEmbedIframe({
            src: `https://store.steampowered.com/widget/${regexMatch[1]}/`,
            containerClass: "steam-embed",
        });
    }
}

export class GoogleCalendarEmbed extends EmbedBase {
    name: SupportedWebsites = "Google Calendar";
    regex = new RegExp(/https:\/\/calendar\.google\.com\/calendar(?:\/(?:u\/\d+))?(?:\/(?:r|embed))?(?:[/?#].*)?/i);
    embedOrigin = "https://calendar.google.com";

    private decodeGoogleCalendarCid(cid: string): string {
        const normalized = cid.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

        try {
            return atob(padded);
        } catch {
            return cid;
        }
    }

    createEmbed(url: string): HTMLElement {
        if (!this.regex.test(url))
            return this.onErrorCreatingEmbed(url);

        let calendarId = "";
        try {
            const parsed = new URL(url);
            const srcParam = parsed.searchParams.get("src");
            const cidParam = parsed.searchParams.get("cid");

            if (srcParam)
                calendarId = srcParam;
            else if (cidParam)
                calendarId = this.decodeGoogleCalendarCid(cidParam);
        } catch {
            return this.onErrorCreatingEmbed(url);
        }

        if (!calendarId)
            return this.onErrorCreatingEmbed(url, "Google Calendar link is missing src/cid parameter.");

        const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`;

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "google-calendar-embed",
            dataset: { calendarId },
            scrolling: "no",
            cacheKey: calendarId,
        });
    }
}

export class WikipediaEmbed extends EmbedBase {
    name: SupportedWebsites = "Wikipedia";
    regex = new RegExp(/https:\/\/([a-z]+-?[a-z]*)\.wikipedia\.org\/wiki\/([^/?#]+)/);
    embedOrigin = "https://www.wikipedia.org";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const langCode = regexMatch[1];
        const articleTitle = regexMatch[2];

        const embedUrl = `https://${langCode}.wikipedia.org/wiki/${articleTitle}`;

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "wikipedia-embed",
            dataset: { articleTitle, langCode },
            cacheKey: `${langCode}:${articleTitle}`,
        });
    }
}

export class GeogebraEmbed extends EmbedBase {
    name: SupportedWebsites = "Geogebra";
    // Supports geogebra.org material URLs: https://www.geogebra.org/m/{id}
    regex = new RegExp(/https:\/\/(?:www\.)?geogebra\.org\/m\/(\w+)/i);
    embedOrigin = "https://www.geogebra.org";

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const materialId = regexMatch[1];

        const embedUrl = `https://www.geogebra.org/material/iframe/id/${materialId}`;

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "geogebra-embed",
            dataset: { materialId },
            allowFullscreen: true,
            cacheKey: materialId,
        });
    }
}

export class QuizletEmbed extends EmbedBase {
    name: SupportedWebsites = "Quizlet";
    // Match Quizlet links broadly, then parse the set id from varied path shapes.
    regex = new RegExp(/https:\/\/(?:www\.)?quizlet\.com\//i);
    embedOrigin = "https://quizlet.com";

    createEmbed(url: string): HTMLElement {
        if (!this.regex.test(url))
            return this.onErrorCreatingEmbed(url);

        const setId = parseQuizletSetId(url);
        if (!setId)
            return this.onErrorCreatingEmbed(url, "Could not parse Quizlet set ID from URL.");

        const embedUrl = `https://quizlet.com/${setId}/flashcards/embed`;

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "quizlet-embed",
            dataset: { quizletSetId: setId },
            allowFullscreen: true,
            cacheKey: setId,
        });
    }
}
