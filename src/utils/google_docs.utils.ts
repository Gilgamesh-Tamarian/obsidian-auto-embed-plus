import { FileManager, normalizePath, requestUrl, Vault } from "obsidian";
import { ensureFolderExists, hashString, isURL, sanitizeFileName, saveImageUrlToVault } from "src/utility";

const GOOGLE_WORKSPACE_URL_REGEX = /https:\/\/docs\.google\.com\/(document|presentation|spreadsheets)(?:\/u\/\d+)?\/d\/(?!e\/)([A-Za-z0-9_-]+)(?!\/(?:pub|pubhtml))/i;
const MARKDOWN_IMAGE_LINK_REGEX = /!\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+"([^"]*)")?\)/g;
const DATA_URI_IMAGE_REF_REGEX = /^\[([^\]]+)\]:\s*<?(data:image\/([a-zA-Z+]+);base64,([^\s>]+))>?[ \t]*$/gm;
const HTML_IMG_TAG_REGEX = /<img\b[^>]*>/gi;
const HTML_IMG_SRC_ATTRIBUTE_REGEX = /\bsrc\s*=\s*(["'])(.*?)\1/i;

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

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64.replace(/\s+/g, ""));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function toNoteRelativePath(vaultPath: string, noteFolderPath: string): string {
    const normalizedNoteFolderPath = normalizePath(noteFolderPath);
    const prefix = `${normalizedNoteFolderPath}/`;
    return vaultPath.startsWith(prefix) ? vaultPath.slice(prefix.length) : vaultPath;
}

async function saveDataUriImageToVault(
    base64Data: string,
    mimeSubtype: string,
    label: string,
    vault: Vault,
    folderPath: string,
    preferPlainLabel = false,
    debug = false,
): Promise<string | null> {
    const mimeType = `image/${mimeSubtype}`;
    const extension = extensionFromMime(mimeType);
    const safeName = sanitizeFileName(label || "image");
    const fileHash = hashString(base64Data.slice(0, 64));
    const fileName = preferPlainLabel ? `${safeName}.${extension}` : `${safeName}-${fileHash}.${extension}`;
    const filePath = normalizePath(`${folderPath}/${fileName}`);

    try {
        if (!vault.getAbstractFileByPath(filePath)) {
            const data = decodeBase64ToArrayBuffer(base64Data);
            await vault.createBinary(filePath, data);
            if (debug) {
                console.debug("[I link therefore iframe] Saved data URI image to vault:", filePath);
            }
        }
        return filePath;
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed to save data URI image to vault:", error);
        }
        return null;
    }
}

async function localizeMarkdownImageLinks(
    markdown: string,
    vault: Vault,
    noteFolderPath: string,
    assetsFolderPath: string,
    debug = false,
): Promise<string> {
    const matches = Array.from(markdown.matchAll(MARKDOWN_IMAGE_LINK_REGEX));
    if (matches.length === 0)
        return markdown;

    const cache = new Map<string, string>();
    let output = "";
    let lastIndex = 0;
    let localizedCount = 0;

    for (const match of matches) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        output += markdown.slice(lastIndex, start);

        const altText = match[1] ?? "";
        const rawUrl = match[2] ?? "";
        const title = match[3];
        const originalLink = match[0];
        const normalizedUrl = rawUrl.replace(/^<|>$/g, "").trim();

        if (!normalizedUrl) {
            output += originalLink;
            lastIndex = end;
            continue;
        }

        if (normalizedUrl.startsWith("data:")) {
            const m = normalizedUrl.match(/^data:image\/([a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)$/);
            if (m) {
                await ensureFolderExists(vault, assetsFolderPath);
                const cacheKey = `data:${m[2].slice(0, 40)}`;
                let localPath = cache.get(cacheKey);
                if (!localPath) {
                    const saved = await saveDataUriImageToVault(m[2], m[1], altText || "image", vault, assetsFolderPath, false, debug);
                    if (saved) {
                        localPath = saved;
                        cache.set(cacheKey, localPath);
                    }
                }
                if (localPath) {
                    const noteRelativePath = toNoteRelativePath(localPath, noteFolderPath);
                    const titleSegment = title ? ` "${title}"` : "";
                    output += `![${altText}](<${noteRelativePath}>${titleSegment})`;
                    lastIndex = end;
                    localizedCount += 1;
                    continue;
                }
            }
            output += originalLink;
            lastIndex = end;
            continue;
        }

        if (!isURL(normalizedUrl)) {
            output += originalLink;
            lastIndex = end;
            continue;
        }

        let localPath = cache.get(normalizedUrl);
        if (localPath === undefined) {
            localPath = await saveImageUrlToVault(normalizedUrl, vault, assetsFolderPath, debug);
            cache.set(normalizedUrl, localPath);
        }

        if (!localPath || localPath === normalizedUrl) {
            output += originalLink;
            lastIndex = end;
            continue;
        }

        const noteRelativePath = toNoteRelativePath(localPath, noteFolderPath);
        const titleSegment = title ? ` "${title}"` : "";
        output += `![${altText}](<${noteRelativePath}>${titleSegment})`;
        lastIndex = end;
        localizedCount += 1;
    }

    output += markdown.slice(lastIndex);

    if (debug && localizedCount > 0) {
        console.debug("[I link therefore iframe] Localized markdown image links:", localizedCount);
    }

    return output;
}

async function localizeHtmlImageTagSources(
    markdown: string,
    vault: Vault,
    noteFolderPath: string,
    assetsFolderPath: string,
    debug = false,
): Promise<string> {
    const matches = Array.from(markdown.matchAll(HTML_IMG_TAG_REGEX));
    if (matches.length === 0)
        return markdown;

    const cache = new Map<string, string>();
    let output = "";
    let lastIndex = 0;
    let localizedCount = 0;

    for (const match of matches) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        output += markdown.slice(lastIndex, start);

        const originalTag = match[0];
        const srcMatch = originalTag.match(HTML_IMG_SRC_ATTRIBUTE_REGEX);
        if (!srcMatch?.[2]) {
            output += originalTag;
            lastIndex = end;
            continue;
        }

        const normalizedUrl = srcMatch[2].replace(/^<|>$/g, "").trim();
        if (!normalizedUrl || normalizedUrl.startsWith("data:") || !isURL(normalizedUrl)) {
            output += originalTag;
            lastIndex = end;
            continue;
        }

        let localPath = cache.get(normalizedUrl);
        if (localPath === undefined) {
            localPath = await saveImageUrlToVault(normalizedUrl, vault, assetsFolderPath, debug);
            cache.set(normalizedUrl, localPath);
        }

        if (!localPath || localPath === normalizedUrl) {
            output += originalTag;
            lastIndex = end;
            continue;
        }

        const noteRelativePath = toNoteRelativePath(localPath, noteFolderPath);
        const quote = srcMatch[1];
        const updatedTag = originalTag.replace(HTML_IMG_SRC_ATTRIBUTE_REGEX, `src=${quote}${noteRelativePath}${quote}`);
        output += updatedTag;
        lastIndex = end;
        localizedCount += 1;
    }

    output += markdown.slice(lastIndex);

    if (debug && localizedCount > 0) {
        console.debug("[I link therefore iframe] Localized HTML image tags:", localizedCount);
    }

    return output;
}

async function localizeDataUriImageRefs(
    markdown: string,
    vault: Vault,
    noteFolderPath: string,
    assetsFolderPath: string,
    debug = false,
): Promise<string> {
    const matches = Array.from(markdown.matchAll(DATA_URI_IMAGE_REF_REGEX));
    if (matches.length === 0)
        return markdown;

    await ensureFolderExists(vault, assetsFolderPath);
    let output = markdown;
    let savedCount = 0;
    const labelToPath = new Map<string, string>();

    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const label = match[1];
        const mimeSubtype = match[3];
        const base64Data = match[4];
        const start = match.index ?? 0;
        const end = start + match[0].length;

        const localPath = await saveDataUriImageToVault(base64Data, mimeSubtype, label, vault, assetsFolderPath, true, debug);
        if (!localPath)
            continue;

        const noteRelativePath = toNoteRelativePath(localPath, noteFolderPath);
        const lineStart = output.lastIndexOf("\n", start - 1) + 1;
        const lineEndIndex = output.indexOf("\n", end);
        const lineEnd = lineEndIndex === -1 ? output.length : lineEndIndex + 1;
        output = output.slice(0, lineStart) + output.slice(lineEnd);
        labelToPath.set(label, noteRelativePath);
        savedCount += 1;
    }

    if (labelToPath.size > 0) {
        output = output.replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, (fullMatch, altText, label) => {
            const targetPath = labelToPath.get(label);
            if (!targetPath)
                return fullMatch;

            return `![${altText}](<${targetPath}>)`;
        });

        // Remove vertical whitespace left behind by deleted reference definition lines.
        output = output.replace(/\n{3,}/g, "\n\n");
    }

    if (debug && savedCount > 0) {
        console.debug("[I link therefore iframe] Localized data URI image references:", savedCount);
    }

    return output;
}

function parseContentDispositionFileName(contentDisposition: string): string | null {
    if (!contentDisposition)
        return null;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]).replace(/^"|"$/g, "");
        } catch {
            return utf8Match[1].replace(/^"|"$/g, "");
        }
    }

    const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (simpleMatch?.[1]) {
        return simpleMatch[1];
    }

    return null;
}

export interface GoogleDocsUpdateResult {
    total: number;
    updated: number;
    errors: number;
}

export async function updateAllGoogleDocs(
    vault: Vault,
    fileManager: FileManager,
    folderPath: string,
    debug = false,
): Promise<GoogleDocsUpdateResult> {
    const sourceUrls = new Set<string>();

    const normalizedFolder = normalizePath(folderPath);
    for (const file of vault.getMarkdownFiles()) {
        if (!normalizePath(file.parent?.path ?? "").startsWith(normalizedFolder)) continue;
        try {
            const content = await vault.read(file);
            const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/);
            if (!frontmatterMatch) continue;
            const sourceMatch = frontmatterMatch[0].match(/^google-docs-source:\s*["']?(.+?)["']?\s*$/m);
            const sourceUrl = sourceMatch?.[1]?.trim();
            if (sourceUrl && GOOGLE_WORKSPACE_URL_REGEX.test(sourceUrl)) {
                sourceUrls.add(sourceUrl);
            }
        } catch {
            // skip unreadable files
        }
    }

    const uniqueUrls = [...sourceUrls];
    let updated = 0;
    let errors = 0;

    for (const sourceUrl of uniqueUrls) {
        try {
            await saveGoogleDocToVault(sourceUrl, vault, fileManager, folderPath, "md", "pdf", "pdf", true, debug);
            updated++;
        } catch {
            errors++;
        }
    }

    return { total: uniqueUrls.length, updated, errors };
}

export async function saveGoogleDocToVault(
    url: string,
    vault: Vault,
    fileManager: FileManager,
    folderPath: string,
    docsFormat: "md" | "pdf" | "docx" | "odt" = "md",
    slidesFormat: "pdf" | "pptx" | "odp" = "pdf",
    sheetsFormat: "pdf" | "xlsx" | "ods" = "pdf",
    forceOverwrite = false,
    debug = false,
): Promise<void> {
    const workspaceMatch = url.match(GOOGLE_WORKSPACE_URL_REGEX);
    if (!workspaceMatch?.[1] || !workspaceMatch?.[2])
        return;

    const resourceType = workspaceMatch[1];
    const resourceId = workspaceMatch[2];

    await ensureFolderExists(vault, folderPath);

    if (resourceType === "document") {
        // Determine export format and extension
        const exportFormat: "md" | "pdf" | "docx" | "odt" = docsFormat;
        const fileExtension = docsFormat;
        const exportUrl = `https://docs.google.com/document/d/${resourceId}/export?format=${exportFormat}`;

        try {
            const response = await requestUrl({ url: exportUrl, method: "GET" });
            const contentType = response.headers["content-type"] ?? "";

            // If the response is HTML the document is private or inaccessible.
            if (contentType.startsWith("text/html")) {
                if (debug) {
                    console.debug("[I link therefore iframe] Google Doc is not publicly accessible, skipping download:", url);
                }
                return;
            }

            // Use content-disposition header as primary source, fall back to first heading, then short-id label.
            const contentDisposition = response.headers["content-disposition"] ?? "";
            const dispositionName = parseContentDispositionFileName(contentDisposition) ?? "";
            const titleFromDisposition = dispositionName.replace(new RegExp(`\\.${fileExtension}$`, "i"), "").trim();
            let title = titleFromDisposition;
            if (!title && exportFormat === "md") {
                // For markdown, try to extract heading
                const content = response.text;
                const headingMatch = content.match(/^#+\s+(.+)/m);
                const headingTitle = headingMatch?.[1]?.trim();
                title = headingTitle || `google-doc-${resourceId.slice(0, 8)}`;
            }
            if (!title) {
                title = `google-doc-${resourceId.slice(0, 8)}`;
            }
            const fileName = `${sanitizeFileName(title)}.${fileExtension}`;
            const filePath = normalizePath(`${folderPath}/${fileName}`);
            const existingDocFile = vault.getAbstractFileByPath(filePath);
            if (existingDocFile && !forceOverwrite) return;

            if (existingDocFile) {
                await fileManager.trashFile(existingDocFile);
            }

            if (exportFormat === "md") {
                // Markdown: localize images and add frontmatter
                const assetsFolderPath = normalizePath(`${folderPath}/${sanitizeFileName(title)}-assets`);
                const content = response.text;
                const step1 = await localizeDataUriImageRefs(content, vault, folderPath, assetsFolderPath, debug);
                const step2 = await localizeMarkdownImageLinks(step1, vault, folderPath, assetsFolderPath, debug);
                const localizedContent = await localizeHtmlImageTagSources(step2, vault, folderPath, assetsFolderPath, debug);
                const contentWithSource = `---\ngoogle-docs-source: "${url}"\n---\n\n${localizedContent}`;
                await vault.create(filePath, contentWithSource);
                if (debug) {
                    console.debug("[I link therefore iframe] Saved Google Doc as Markdown to vault:", filePath);
                }
            } else {
                // Binary formats: pdf, docx, odt
                await vault.createBinary(filePath, response.arrayBuffer);
                if (debug) {
                    console.debug(`Saved Google Doc as ${exportFormat} to vault:`, filePath);
                }
            }
        } catch (error) {
            if (debug) {
                console.error("[I link therefore iframe] Failed to save Google Doc to vault:", error);
            }
        }

        return;
    }

    if (resourceType !== "presentation" && resourceType !== "spreadsheets")
        return;

    const isPresentation = resourceType === "presentation";
    const format = isPresentation ? slidesFormat : sheetsFormat;
    const exportFormat = isPresentation
        ? (format === "pptx" ? "pptx" : format === "odp" ? "odp" : "pdf")
        : (format === "xlsx" ? "xlsx" : format === "ods" ? "ods" : "pdf");

    const exportUrl = `https://docs.google.com/${resourceType}/d/${resourceId}/export?format=${exportFormat}`;
    const readableType = isPresentation ? "Google Slides" : "Google Sheets";
    const fileExtension = exportFormat;

    try {
        const response = await requestUrl({ url: exportUrl, method: "GET" });
        const contentType = response.headers["content-type"] ?? "";

        // If the response is HTML the file is private or inaccessible.
        if (contentType.startsWith("text/html")) {
            if (debug) {
                console.debug(`[I link therefore iframe] ${readableType} file is not publicly accessible, skipping download:`, url);
            }
            return;
        }

        const contentDisposition = response.headers["content-disposition"] ?? "";
        const dispositionName = parseContentDispositionFileName(contentDisposition) ?? "";
        const titleFromDisposition = dispositionName.replace(/\.(pdf|xlsx?|csv|ods|odp|pptx?)$/i, "");
        const fallbackPrefix = isPresentation ? "google-slide" : "google-sheet";
        const title = titleFromDisposition || `${fallbackPrefix}-${resourceId.slice(0, 8)}`;
        const fileName = `${sanitizeFileName(title)}.${fileExtension}`;
        const filePath = normalizePath(`${folderPath}/${fileName}`);

        const existingBinaryFile = vault.getAbstractFileByPath(filePath);
        if (existingBinaryFile && !forceOverwrite) return;
        if (existingBinaryFile) await fileManager.trashFile(existingBinaryFile);

        await vault.createBinary(filePath, response.arrayBuffer);
        if (debug) {
            console.debug(`[I link therefore iframe] Saved ${readableType} ${fileExtension.toUpperCase()} to vault:`, filePath);
        }
    } catch (error) {
        if (debug) {
            console.error(`[I link therefore iframe] Failed to save ${readableType} PDF to vault:`, error);
        }
    }
}
