import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: CodePen, Google Docs, Google Drive.

export class CodepenEmbed extends EmbedBase {
    name: SupportedWebsites = "CodePen";
    regex = new RegExp(/https:\/\/codepen\.io\/([\w-]+)\/pen\/(\w+)(\?.*)?/);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        return this.createEmbedIframe({
            src: `https://codepen.io/${regexMatch[1]}/embed/${regexMatch[2]}?default-tab=result&editable=true`,
            containerClass: "codepen-embed",
        });
    }
}

export class GoogleDocsEmbed extends EmbedBase {
    name: SupportedWebsites = "Google Docs";
    // Matches standard and user-scoped Docs URLs, but NOT published pages —
    // /d/e/ is the published-document key prefix, and /pub marks a published view.
    // Both are treated as regular websites by the generic iframe fallback.
    regex = new RegExp(/https:\/\/docs\.google\.com\/document(?:\/u\/\d+)?\/d\/(?!e\/)([A-Za-z0-9_-]+)(?!\/pub)/i);

    createEmbed(url: string): HTMLElement {
        const regexMatch = url.match(this.regex);
        if (regexMatch === null)
            return this.onErrorCreatingEmbed(url);

        const documentId = regexMatch[1];
        const src = `https://docs.google.com/document/d/${documentId}/preview`;

        return this.createEmbedIframe({
            src,
            containerClass: "google-docs-embed-preview",
        });
    }
}

export class GoogleDriveEmbed extends EmbedBase {
    name: SupportedWebsites = "Google Drive";
    // Supports common Drive file-sharing URLs, e.g.:
    // - https://drive.google.com/file/d/{id}/view?usp=sharing
    // - https://drive.google.com/open?id={id}
    regex = new RegExp(/https:\/\/drive\.google\.com\//i);

    private parseDriveFileId(url: string): string | null {
        try {
            const parsed = new URL(url);

            const pathMatch = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/i);
            if (pathMatch?.[1]) {
                return pathMatch[1];
            }

            const queryId = parsed.searchParams.get("id");
            if (queryId) {
                return queryId;
            }
        } catch {
            return null;
        }

        return null;
    }

    createEmbed(url: string): HTMLElement {
        if (!this.regex.test(url)) {
            return this.onErrorCreatingEmbed(url);
        }

        const fileId = this.parseDriveFileId(url);
        if (!fileId) {
            return this.onErrorCreatingEmbed(url, "Could not parse Google Drive file ID from URL.");
        }

        const src = `https://drive.google.com/file/d/${fileId}/preview`;

        return this.createEmbedIframe({
            src,
            containerClass: "google-drive-embed-preview",
            allow: "autoplay",
            allowFullscreen: true,
            cacheKey: fileId,
        });
    }
}
