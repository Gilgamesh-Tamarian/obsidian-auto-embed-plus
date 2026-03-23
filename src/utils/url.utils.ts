
export function isUrl(text: string): boolean {
    const urlRegex = new RegExp(
        "^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$"
    );
    return urlRegex.test(text);
}

export function parseQuizletSetId(rawUrl: string): string | null {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return null;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (!(hostname === "quizlet.com" || hostname === "www.quizlet.com")) {
        return null;
    }

    const pathSegments = parsedUrl.pathname
        .split("/")
        .filter(Boolean)
        .map(segment => decodeURIComponent(segment));

    for (let i = pathSegments.length - 1; i >= 0; i--) {
        const segment = pathSegments[i];
        if (!segment) {
            continue;
        }

        if (/^\d+$/.test(segment)) {
            return segment;
        }

        const trailingIdMatch = segment.match(/-(\d+)$/);
        if (trailingIdMatch?.[1]) {
            return trailingIdMatch[1];
        }

        const leadingIdMatch = segment.match(/^(\d+)-/);
        if (leadingIdMatch?.[1]) {
            return leadingIdMatch[1];
        }
    }

    return null;
}