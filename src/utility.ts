import { normalizePath, requestUrl, Vault } from "obsidian";

/**
 * Sets multiple CSS properties on an element.
 * @param el The HTMLElement to modify.
 * @param props An object mapping CSS property names to values.
 */
export function setCssProps(el: HTMLElement, props: { [key: string]: string }) {
    for (const key in props) {
        const cssKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        el.style.setProperty(cssKey, props[key]);
    }
}
export function isURL(str: string) : boolean {
    let url: URL;

    try {
        url = new URL(str);
    } catch {
        return false;
    }
    
    return url.protocol === "http:" || url.protocol === "https:";
}

export function isLinkToImage(str: string) : boolean {
    const url = new URL(str);
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url.pathname);
}

export interface Dictionary<T> {
    [key: string]: T;
}

export interface Size {
    width: number;
    height: number;
}

interface MastodonStatusInfo {
    instance: string;
    statusId: string;
}

interface SteamAppInfo {
    appId: string;
}

const IMAGE_EXTENSION_REGEX = /\.(jpg|jpeg|png|webp|avif|gif|svg|bmp|tiff?)$/i;
const MASTODON_STATUS_URL_REGEX =
    /^https:\/\/([^/]+)\/(?:@[A-Za-z0-9_.-]+\/(\d+)|users\/[A-Za-z0-9_.-]+\/statuses\/(\d+))(?:$|[?#])/;
const REDDIT_POST_URL_REGEX = /reddit\.com\/.*\/comments\/([a-z0-9]+)/i;
const TIKTOK_URL_REGEX = /^https:\/\/(?:www\.)?tiktok\.com\//i;
const INSTAGRAM_URL_REGEX = /^https:\/\/(?:(?:www|m)\.)?instagram\.com\/|^https:\/\/instagr\.am\//i;
const FACEBOOK_URL_REGEX = /^https:\/\/(?:(?:www|m|mbasic)\.)?facebook\.com\/|^https:\/\/fb\.watch\//i;
const PINTEREST_URL_REGEX = /^https:\/\/(?:[a-z]{2}\.)?(?:www\.)?pinterest\.[a-z.]+\//i;
const TELEGRAM_POST_URL_REGEX = /^https:\/\/(?:t(?:elegram)?\.me)\/(?:s\/)?[A-Za-z0-9_]{5,}\/\d+(?:$|[?#])/i;
const IMGUR_URL_REGEX = /^https:\/\/(?:i\.)?imgur\.com\//i;
const SOUNDCLOUD_URL_REGEX = /^https:\/\/(?:www\.)?soundcloud\.com\//i;
const SPOTIFY_URL_REGEX = /^https:\/\/(?:open|play|www)\.spotify\.com\//i;
const CODEPEN_URL_REGEX = /^https:\/\/codepen\.io\//i;
const STEAM_APP_URL_REGEX = /store\.steampowered\.com\/app\/(\d+)/i;
const GOOGLE_DOCS_URL_REGEX = /https:\/\/docs\.google\.com\/document(?:\/u\/\d+)?\/d\/(?!e\/)([A-Za-z0-9_-]+)(?!\/pub)/i;

export function hashString(value: string): string {
    let hash = 2166136261;

    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash +=
            (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
}

export function sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "image";
}

function isLikelyGibberishFileName(name: string): boolean {
    const normalized = name.replace(/[_\-\s]/g, "");

    if (normalized.length < 6) {
        return true;
    }

    const isHexLike = /^[a-fA-F0-9]{12,}$/.test(normalized);
    if (isHexLike) {
        return true;
    }

    const hasLetters = /[A-Za-z]/.test(normalized);
    const hasDigits = /\d/.test(normalized);
    const isLongAlphaNum = /^[A-Za-z0-9]{18,}$/.test(normalized);

    return hasLetters && hasDigits && isLongAlphaNum;
}

function practicalBaseNameFromUrl(url: string, rawBase: string): string {
    const candidate = sanitizeFileName(rawBase || "image");

    if (!isLikelyGibberishFileName(candidate) && candidate.toLowerCase() !== "image") {
        return candidate;
    }

    const parsed = new URL(url);
    const hostPart = sanitizeFileName(
        parsed.hostname.replace(/^www\./, "").replace(/\./g, "-")
    );

    return `${hostPart}-embed-image`;
}

function extensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
        "image/gif": "gif",
        "image/svg+xml": "svg",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
    };

    return mimeMap[mimeType.toLowerCase()] ?? "png";
}

function fileInfoFromUrl(url: string, fallbackExtension: string): { baseName: string; extension: string } {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "image";

    const extMatch = lastSegment.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch?.[1] ? extMatch[1].toLowerCase() : fallbackExtension;
    const rawBase = extMatch?.index ? lastSegment.slice(0, extMatch.index) : lastSegment;

    return {
        baseName: practicalBaseNameFromUrl(url, rawBase),
        extension,
    };
}

export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const segments = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        // Exists check avoids throwing repeatedly in nested folders.
        const exists = await vault.adapter.exists(currentPath);
        if (!exists) {
            await vault.createFolder(currentPath);
        }
    }
}

export async function saveImageUrlToVault(
    url: string,
    vault: Vault,
    folderPath: string,
    debug: boolean = false,
): Promise<string> {
    if (!url || url.startsWith("data:") || !isURL(url)) {
        return url;
    }

    try {
        let mimeType = "";
        let isImage = false;

        const parsed = new URL(url);
        if (IMAGE_EXTENSION_REGEX.test(parsed.pathname)) {
            isImage = true;
        } else {
            try {
                const headResponse = await requestUrl({ url, method: "HEAD" });
                mimeType = headResponse.headers["content-type"]?.split(";")[0] ?? "";
                isImage = mimeType.startsWith("image/");
            } catch {
                isImage = false;
            }
        }

        if (!isImage) {
            return url;
        }

        await ensureFolderExists(vault, folderPath);

        const getResponse = await requestUrl({ url, method: "GET" });
        const responseMime =
            getResponse.headers["content-type"]?.split(";")[0] ?? mimeType;
        const fallbackExt = extensionFromMime(responseMime || "image/png");
        const fileInfo = fileInfoFromUrl(url, fallbackExt);
        const fileHash = hashString(url);
        const fileName = `${fileInfo.baseName}-${fileHash}.${fileInfo.extension}`;
        const filePath = normalizePath(`${folderPath}/${fileName}`);

        const existingFile = vault.getAbstractFileByPath(filePath);
        if (!existingFile) {
            await vault.createBinary(filePath, getResponse.arrayBuffer);
            if (debug) {
                console.log("[I link therefore iframe] Saved image to vault:", filePath);
            }
        }

        return filePath;
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed saving image to vault:", error);
        }
        return url;
    }
}

function getMastodonStatusInfo(url: string): MastodonStatusInfo | null {
    const match = url.match(MASTODON_STATUS_URL_REGEX);

    if (!match) {
        return null;
    }

    const instance = match[1];
    const statusId = match[2] || match[3];

    if (!instance || !statusId) {
        return null;
    }

    return {
        instance,
        statusId,
    };
}

function getSteamAppInfo(url: string): SteamAppInfo | null {
    const match = url.match(STEAM_APP_URL_REGEX);

    if (!match || !match[1]) {
        return null;
    }

    return {
        appId: match[1],
    };
}

function decodeHtmlUrlEntities(url: string): string {
    return url.replace(/&amp;/g, "&");
}

function asImageUrlOrNull(url: string | undefined | null): string | null {
    if (!url) {
        return null;
    }

    const normalized = decodeHtmlUrlEntities(url);
    return isURL(normalized) ? normalized : null;
}

function firstImageUrl(candidates: Array<string | undefined | null>): string | null {
    for (const candidate of candidates) {
        const normalized = asImageUrlOrNull(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

async function resolveMastodonImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    const mastodonInfo = getMastodonStatusInfo(url);

    if (!mastodonInfo) {
        return null;
    }

    try {
        const apiUrl = `https://${mastodonInfo.instance}/api/v1/statuses/${mastodonInfo.statusId}`;
        const response = await requestUrl({ url: apiUrl, method: "GET" });
        const status = response.json as {
            media_attachments?: Array<{ type?: string; url?: string; preview_url?: string }>;
            reblog?: {
                media_attachments?: Array<{ type?: string; url?: string; preview_url?: string }>;
            };
        };

        const attachments = [
            ...(status.media_attachments ?? []),
            ...(status.reblog?.media_attachments ?? []),
        ];

        const imageAttachment = attachments.find((attachment) => {
            const attachmentUrl = attachment.url || attachment.preview_url || "";
            return attachment.type === "image" && isURL(attachmentUrl);
        });

        if (!imageAttachment) {
            return null;
        }

        return imageAttachment.url || imageAttachment.preview_url || null;
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed to resolve Mastodon image:", error);
        }
        return null;
    }
}

async function resolveRedditImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!REDDIT_POST_URL_REGEX.test(url)) {
        return null;
    }

    try {
        const baseUrl = url.split("?")[0].replace(/\/$/, "");
        const apiUrl = `${baseUrl}.json?raw_json=1`;
        const response = await requestUrl({ url: apiUrl, method: "GET" });
        const listing = response.json as Array<{
            data?: {
                children?: Array<{
                    data?: {
                        url_overridden_by_dest?: string;
                        preview?: {
                            images?: Array<{
                                source?: {
                                    url?: string;
                                };
                            }>;
                        };
                        media_metadata?: Record<
                            string,
                            {
                                e?: string;
                                s?: { u?: string };
                            }
                        >;
                        gallery_data?: {
                            items?: Array<{ media_id?: string }>;
                        };
                    };
                }>;
            };
        }>;

        const postData = listing?.[0]?.data?.children?.[0]?.data;
        if (!postData) {
            return null;
        }

        const mediaMetadata = postData.media_metadata ?? {};
        const galleryItems = postData.gallery_data?.items ?? [];
        const galleryFirstImage = galleryItems
            .map((item) => (item.media_id ? mediaMetadata[item.media_id] : undefined))
            .find((item) => item?.e === "Image")?.s?.u;

        const metadataFirstImage = Object.values(mediaMetadata)
            .find((item) => item?.e === "Image")?.s?.u;

        return firstImageUrl([
            postData.url_overridden_by_dest,
            postData.preview?.images?.[0]?.source?.url,
            galleryFirstImage,
            metadataFirstImage,
        ]);
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed to resolve Reddit image:", error);
        }
        return null;
    }
}

async function resolveOEmbedThumbnail(
    endpointUrl: string,
    debugContext: string,
    debug: boolean = false,
): Promise<string | null> {
    try {
        const response = await requestUrl({ url: endpointUrl, method: "GET" });
        const data = response.json as {
            thumbnail_url?: string;
            url?: string;
        };

        return firstImageUrl([data.thumbnail_url, data.url]);
    } catch (error) {
        if (debug) {
            console.error(`[I link therefore iframe] Failed to resolve ${debugContext} image:`, error);
        }
        return null;
    }
}

async function resolveOpenGraphImageUrl(
    url: string,
    debugContext: string,
    debug: boolean = false,
): Promise<string | null> {
    try {
        const response = await requestUrl({ url, method: "GET" });
        const html = response.text ?? "";

        const metaTags = Array.from(html.matchAll(/<meta\s+[^>]*>/gi)).map((m) => m[0]);
        const ogCandidates: string[] = [];
        const twitterCandidates: string[] = [];

        for (const tag of metaTags) {
            const keyMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
            const contentMatch = tag.match(/content=["']([^"']+)["']/i);
            const key = keyMatch?.[1]?.toLowerCase();
            const content = contentMatch?.[1];

            if (!key || !content)
                continue;

            if (key === "og:image" || key === "og:image:secure_url")
                ogCandidates.push(content);

            if (key === "twitter:image" || key === "twitter:image:src")
                twitterCandidates.push(content);
        }

        return firstImageUrl([...ogCandidates, ...twitterCandidates]);
    } catch (error) {
        if (debug) {
            console.error(`[I link therefore iframe] Failed to resolve ${debugContext} OpenGraph image:`, error);
        }
        return null;
    }
}

async function resolveTikTokImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!TIKTOK_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOEmbedThumbnail(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        "TikTok",
        debug,
    );
}

async function resolveImgurImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!IMGUR_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOEmbedThumbnail(
        `https://api.imgur.com/oembed.json?url=${encodeURIComponent(url)}`,
        "Imgur",
        debug,
    );
}

async function resolveSoundCloudImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!SOUNDCLOUD_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOEmbedThumbnail(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        "SoundCloud",
        debug,
    );
}

async function resolveSpotifyImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!SPOTIFY_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOEmbedThumbnail(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
        "Spotify",
        debug,
    );
}

async function resolveCodepenImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!CODEPEN_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOEmbedThumbnail(
        `https://codepen.io/api/oembed?format=json&url=${encodeURIComponent(url)}`,
        "CodePen",
        debug,
    );
}

async function resolveInstagramImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!INSTAGRAM_URL_REGEX.test(url)) {
        return null;
    }

    // Instagram oEmbed may be restricted in some environments, so use it as optional first pass.
    const oembedResult = await resolveOEmbedThumbnail(
        `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`,
        "Instagram",
        debug,
    );
    if (oembedResult) {
        return oembedResult;
    }

    // Fall back to OpenGraph scraping across common Instagram host variants.
    const candidates = new Set<string>([url]);

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host.endsWith("instagram.com") || host === "instagr.am") {
            const hostVariants = ["www.instagram.com", "m.instagram.com", "instagr.am"];
            for (const variant of hostVariants) {
                const variantUrl = new URL(parsed.toString());
                variantUrl.hostname = variant;
                candidates.add(variantUrl.toString());
            }
        }
    } catch {
        // Keep original URL if parsing fails.
    }

    for (const candidate of candidates) {
        const resolved = await resolveOpenGraphImageUrl(candidate, "Instagram", debug);
        if (resolved) {
            return resolved;
        }
    }

    return null;
}

async function resolveFacebookImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!FACEBOOK_URL_REGEX.test(url)) {
        return null;
    }

    // Facebook has no anonymous oEmbed anymore, so we rely on best-effort HTML metadata.
    const candidates = new Set<string>([url]);

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host.endsWith("facebook.com")) {
            const hostVariants = ["www.facebook.com", "m.facebook.com", "mbasic.facebook.com"];
            for (const variant of hostVariants) {
                const variantUrl = new URL(parsed.toString());
                variantUrl.hostname = variant;
                candidates.add(variantUrl.toString());
            }
        }
    } catch {
        // Ignore parse errors and keep original URL candidate only.
    }

    for (const candidate of candidates) {
        const resolved = await resolveOpenGraphImageUrl(candidate, "Facebook", debug);
        if (resolved)
            return resolved;
    }

    return null;
}

async function resolvePinterestImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!PINTEREST_URL_REGEX.test(url)) {
        return null;
    }

    const oembedResult = await resolveOEmbedThumbnail(
        `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`,
        "Pinterest",
        debug,
    );

    if (oembedResult) {
        return oembedResult;
    }

    return await resolveOpenGraphImageUrl(url, "Pinterest", debug);
}

async function resolveTelegramImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    if (!TELEGRAM_POST_URL_REGEX.test(url)) {
        return null;
    }

    return await resolveOpenGraphImageUrl(url, "Telegram", debug);
}

async function resolveSteamImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    const steamInfo = getSteamAppInfo(url);
    if (!steamInfo) {
        return null;
    }

    try {
        const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${steamInfo.appId}&l=en`;
        const response = await requestUrl({ url: apiUrl, method: "GET" });
        const data = response.json as Record<
            string,
            {
                success?: boolean;
                data?: {
                    header_image?: string;
                    screenshots?: Array<{ path_full?: string }>;
                };
            }
        >;

        const appData = data?.[steamInfo.appId]?.data;
        return firstImageUrl([
            appData?.screenshots?.[0]?.path_full,
            appData?.header_image,
        ]);
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed to resolve Steam image:", error);
        }
        return null;
    }
}

export async function resolveSocialMediaImageUrl(
    url: string,
    debug: boolean = false,
): Promise<string | null> {
    const resolvers = [
        resolveFacebookImageUrl,
        resolveInstagramImageUrl,
        resolvePinterestImageUrl,
        resolveTelegramImageUrl,
        resolveMastodonImageUrl,
        resolveRedditImageUrl,
        resolveTikTokImageUrl,
        resolveImgurImageUrl,
        resolveSoundCloudImageUrl,
        resolveSpotifyImageUrl,
        resolveCodepenImageUrl,
        resolveSteamImageUrl,
    ];

    for (const resolver of resolvers) {
        const resolved = await resolver(url, debug);
        if (resolved) {
            return resolved;
        }
    }

    return null;
}

    export async function saveGoogleDocToVault(
        url: string,
        vault: Vault,
        folderPath: string,
        debug: boolean = false,
    ): Promise<void> {
        const match = url.match(GOOGLE_DOCS_URL_REGEX);
        if (!match || !match[1]) return;

        const documentId = match[1];
        const exportUrl = `https://docs.google.com/document/d/${documentId}/export?format=md`;

        try {
            const response = await requestUrl({ url: exportUrl, method: "GET" });
            const contentType = response.headers["content-type"] ?? "";

            // If the response is HTML the document is private or inaccessible.
            if (contentType.startsWith("text/html")) {
                if (debug) {
                    console.log("[I link therefore iframe] Google Doc is not publicly accessible, skipping download:", url);
                }
                return;
            }

            const content = response.text;
            if (!content) return;

            // Use the first heading as the filename, falling back to a sortable short-id label.
            const titleMatch = content.match(/^#\s+(.+)/m);
            const title = titleMatch?.[1]?.trim() || `google-doc-${documentId.slice(0, 8)}`;
            const fileHash = hashString(documentId);
            const fileName = `${sanitizeFileName(title)}-${fileHash}.md`;

            await ensureFolderExists(vault, folderPath);
            const filePath = normalizePath(`${folderPath}/${fileName}`);

            if (!vault.getAbstractFileByPath(filePath)) {
                await vault.create(filePath, content);
                if (debug) {
                    console.log("[I link therefore iframe] Saved Google Doc to vault:", filePath);
                }
            }
        } catch (error) {
            if (debug) {
                console.error("[I link therefore iframe] Failed to save Google Doc to vault:", error);
            }
        }
    }

