import { AspectRatioType } from "src/types/aspect-ratio";

interface DefaultSizing {
    aspectRatio?: string;
    height?: string;
    minHeight?: string;
}

function getPlatformDefaults(url: URL): DefaultSizing {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    // Video platforms
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return { aspectRatio: "16/9", minHeight: "400px" };
    }

    if (host.includes("vimeo.com")) {
        return { aspectRatio: "16/9", minHeight: "420px" };
    }

    if (host.includes("dailymotion.com")) {
        return { aspectRatio: "16/9", minHeight: "420px" };
    }

    if (host.includes("vk.com")) {
        return { aspectRatio: "16/9", minHeight: "480px" };
    }

    if (host.includes("twitch.tv")) {
        return { aspectRatio: "16/9", minHeight: "500px" };
    }

    // Vertical video
    if (host.includes("tiktok.com")) {
        return { aspectRatio: "9/16", minHeight: "720px" };
    }

    // Social media - image focused
    if (host.includes("instagram.com")) {
        if (path.includes("/reel/"))
            return { aspectRatio: "9/16", minHeight: "640px" };
        if (path.includes("/tv/"))
            return { aspectRatio: "9/16", minHeight: "640px" };
        return { aspectRatio: "4/5", minHeight: "560px" };
    }

    if (host.includes("imgur.com")) {
        if (path.includes("/a/") || path.includes("/gallery/"))
            return { aspectRatio: "4/5", minHeight: "600px" };
        return { aspectRatio: "16/9", minHeight: "480px" };
    }

    // Audio platforms
    if (host.includes("spotify.com")) {
        if (path.includes("/track/") || path.includes("/embed/track/"))
            return { height: "152px" };
        if (path.includes("/episode/") || path.includes("/embed/episode/"))
            return { height: "232px" };
        if (path.includes("/album/") || path.includes("/embed/album/"))
            return { height: "380px" };
        return { height: "380px" };
    }

    if (host.includes("soundcloud.com") || host.includes("w.soundcloud.com")) {
        if (path.includes("/sets/") || url.searchParams.get("visual") === "true")
            return { height: "450px" };
        if (path.includes("/tracks/"))
            return { height: "166px" };
        return { height: "380px" };
    }

    if (host.includes("music.apple.com")) {
        // ?i= means a single song selected within an album — compact player
        if (url.searchParams.get("i"))
            return { height: "175px" };
        if (path.includes("/playlist/"))
            return { height: "660px" };
        return { height: "450px" };
    }

    if (host.includes("embed.tidal.com")) {
        if (path.includes("/tracks/"))
            return { height: "170px" };
        return { height: "520px" };
    }

    if (host.includes("widget.deezer.com")) {
        if (path.includes("/track/"))
            return { height: "300px" };
        return { height: "520px" };
    }

    // Social networks
    if (host.includes("reddit.com") || host.includes("embed.reddit.com")) {
        return { height: "600px" };
    }

    if (host.includes("x.com") || host.includes("twitter.com")) {
        return { height: "700px" };
    }

    if (host.includes("threads.net") || host.includes("threads.com")) {
        return { height: "620px" };
    }

    if (host.includes("facebook.com")) {
        return { height: "560px" };
    }

    if (host.includes("assets.pinterest.com") || host.includes("pinterest.com")) {
        return { height: "620px" };
    }

    if (host === "t.me" || host === "telegram.me") {
        return { height: "420px" };
    }

    if (host.includes("mastodon") || (path.includes("/embed") && (path.includes("/@") || path.includes("/statuses/")))) {
        return { aspectRatio: "16/9", minHeight: "500px" };
    }

    // Productivity/Code
    if (host.includes("docs.google.com")) {
        return { aspectRatio: "16/9", minHeight: "600px" };
    }

    if (host.includes("codepen.io")) {
        return { aspectRatio: "16/9", minHeight: "520px" };
    }

    if (host.includes("geogebra.org")) {
        return { aspectRatio: "4/3", minHeight: "420px" };
    }

    if (host.includes("quizlet.com")) {
        return { aspectRatio: "5/4" };
    }

    // Gaming
    if (host.includes("steampowered.com")) {
        return { height: "650px" };
    }

    // Fallback
    return { aspectRatio: "16/9", minHeight: "400px" };
}

export function getDefaultSizingForUrl(url: string): DefaultSizing {
    try {
        return getPlatformDefaults(new URL(url));
    } catch {
        return { aspectRatio: "16/9", minHeight: "400px" };
    }
}

export function getAutoAspectRatioForUrl(url: string): AspectRatioType {
    const sizing = getDefaultSizingForUrl(url);
    return (sizing.aspectRatio as AspectRatioType | undefined) ?? "none";
}

function copyOptionalIframeAttribute(target: HTMLIFrameElement, source: HTMLIFrameElement, attribute: string): void {
    const value = source.getAttribute(attribute);
    if (value)
        target.setAttribute(attribute, value);
}

export function buildNativeEmbedMarkup(rawMarkup: string, originalUrl: string, showOriginalLink: boolean = true): string {
    const fragment = document.createElement("template");
    fragment.innerHTML = rawMarkup.trim();

    const root = fragment.content.firstElementChild as HTMLElement | null;
    if (!root)
        return rawMarkup;

    const sourceIframe = root instanceof HTMLIFrameElement
        ? root
        : (root.querySelector("iframe") as HTMLIFrameElement | null);

    if (!sourceIframe)
        return rawMarkup;

    const container = document.createElement("div");
    container.setAttribute(
        "style",
        [
            "width:100%",
            "max-width:100%",
            "overflow:hidden",
            "border:1px solid var(--background-modifier-border)",
            "border-radius:8px",
            "background:var(--background-primary)",
        ].join(";"),
    );

    const iframe = document.createElement("iframe");
    const sourceUrl = sourceIframe.getAttribute("src") || sourceIframe.src || originalUrl;
    iframe.setAttribute("src", sourceUrl);

    iframe.setAttribute("allow", sourceIframe.getAttribute("allow") || "fullscreen");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("loading", sourceIframe.getAttribute("loading") || "lazy");

    copyOptionalIframeAttribute(iframe, sourceIframe, "sandbox");
    copyOptionalIframeAttribute(iframe, sourceIframe, "scrolling");
    copyOptionalIframeAttribute(iframe, sourceIframe, "title");
    copyOptionalIframeAttribute(iframe, sourceIframe, "referrerpolicy");

    let sourceHost = "";
    try {
        sourceHost = new URL(sourceUrl).hostname.toLowerCase();
    } catch {
        sourceHost = "";
    }

    const isQuizlet = sourceHost.includes("quizlet.com");

    // Get platform defaults for this URL
    const sizing = getDefaultSizingForUrl(sourceUrl);

    const iframeStyleParts = [
        "display:block",
        "width:100%",
        "border:0",
        "overflow:hidden",
    ];

    if (sizing.aspectRatio)
        iframeStyleParts.push(`aspect-ratio:${sizing.aspectRatio}`);

    if (sizing.height)
        iframeStyleParts.push(`height:${sizing.height}`);

    if (sizing.minHeight)
        iframeStyleParts.push(`min-height:${sizing.minHeight}`);

    if (isQuizlet) {
        // Cross-origin Quizlet iframes cannot be styled internally, so scale the whole iframe.
        // Using the padding-bottom trick gives a truly fixed 5:4 ratio box regardless of content.
        // height:0 + padding-bottom:80% pins the wrapper height; the iframe sits absolutely inside.
        iframe.setAttribute("style", [
            "position:absolute",
            "top:0",
            "left:0",
            "width:133.3333%",
            "height:133.3333%",
            "transform:scale(0.75)",
            "transform-origin:top left",
            "border:0",
        ].join(";"));
        const clipWrapper = document.createElement("div");
        clipWrapper.setAttribute("style", "position:relative;width:100%;height:0;padding-bottom:80%;overflow:hidden;");
        clipWrapper.appendChild(iframe);
        container.appendChild(clipWrapper);
    } else {
        if (!sizing.height && !sizing.aspectRatio)
            iframeStyleParts.push("height:500px");

        iframe.setAttribute("style", iframeStyleParts.join(";"));
        container.appendChild(iframe);
    }

    if (showOriginalLink) {
        const linkWrapper = document.createElement("p");
        linkWrapper.setAttribute(
            "style",
            "margin:0;padding:8px 10px;font-size:0.9em;border-top:1px solid var(--background-modifier-border)",
        );

        const link = document.createElement("a");
        link.href = originalUrl;
        link.textContent = "Open original link";
        linkWrapper.appendChild(link);
        container.appendChild(linkWrapper);
    }

    return container.outerHTML;
}
