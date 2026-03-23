import { SupportedWebsites } from "src/settings-tab";
import { EmbedBase } from "./embedBase";

// Sites in this file: Google Maps, OpenStreetMap.

export class GoogleMapsEmbed extends EmbedBase {
    name: SupportedWebsites = "Google Maps";
    regex = new RegExp(/https:\/\/(?:(?:www\.)?google\.[^/]+\/(?:maps|map)(?:[/?#]|$)|maps\.google\.[^/]+\/|maps\.app\.goo\.gl\/)/);
    embedOrigin = "https://www.google.com";

    createEmbed(url: string): HTMLElement {
        if (!this.regex.test(url))
            return this.onErrorCreatingEmbed(url);

        const embedUrl = this.toGoogleMapsEmbedUrl(url);

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "google-maps-embed",
            allowFullscreen: true,
        });
    }

    private toGoogleMapsEmbedUrl(url: string): string {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            if (parsed.pathname.startsWith("/maps/embed"))
                return parsed.toString();

            if (host === "maps.app.goo.gl")
                return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;

            const params = new URLSearchParams(parsed.search);

            const q = params.get("q") ?? params.get("query");
            if (q)
                return this.buildGoogleEmbedFromQuery(q, params.get("z"));

            const ll = params.get("ll");
            if (ll)
                return this.buildGoogleEmbedFromQuery(ll, params.get("z"));

            const atMatch = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
            if (atMatch) {
                const lat = atMatch[1];
                const lon = atMatch[2];
                const zoom = atMatch[3];
                return this.buildGoogleEmbedFromQuery(`${lat},${lon}`, zoom);
            }

            const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
            if (placeMatch?.[1])
                return this.buildGoogleEmbedFromQuery(decodeURIComponent(placeMatch[1]).replace(/\+/g, " "), params.get("z"));

            params.set("output", "embed");

            // Preserve existing Google Maps parameters when available.
            if (Array.from(params.keys()).length > 1)
                return `https://www.google.com/maps?${params.toString()}`;
        } catch (_) {
            // Fall through to q-based embed.
        }

        return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
    }

    private buildGoogleEmbedFromQuery(query: string, zoom: string | null): string {
        const params = new URLSearchParams({
            q: query,
            output: "embed",
        });

        if (zoom && /^\d+(?:\.\d+)?$/.test(zoom))
            params.set("z", zoom);

        return `https://www.google.com/maps?${params.toString()}`;
    }
}

export class OpenStreetMapEmbed extends EmbedBase {
    name: SupportedWebsites = "OpenStreetMap";
    regex = new RegExp(/https:\/\/(?:www\.)?(?:openstreetmap\.org|osm\.org)\//);
    embedOrigin = "https://www.openstreetmap.org";

    createEmbed(url: string): HTMLElement {
        if (!this.regex.test(url))
            return this.onErrorCreatingEmbed(url);

        const embedUrl = this.toOpenStreetMapEmbedUrl(url);

        return this.createEmbedIframe({
            src: embedUrl,
            containerClass: "openstreetmap-embed",
            allowFullscreen: true,
        });
    }

    private toOpenStreetMapEmbedUrl(url: string): string {
        try {
            const parsed = new URL(url);
            const hash = parsed.hash;
            const search = new URLSearchParams(parsed.search);

            if (parsed.pathname.startsWith("/export/embed.html"))
                return parsed.toString();

            const mapHash = hash.match(/#map=(\d+)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
            const zoom = this.clampZoom(mapHash?.[1] ?? search.get("zoom") ?? "12");
            const lat = search.get("mlat") ?? mapHash?.[2];
            const lon = search.get("mlon") ?? mapHash?.[3];

            if (lat && lon) {
                const latNum = Number(lat);
                const lonNum = Number(lon);

                if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
                    const delta = 0.03;
                    const south = this.clampLat(latNum - delta);
                    const north = this.clampLat(latNum + delta);
                    const west = this.clampLon(lonNum - delta);
                    const east = this.clampLon(lonNum + delta);

                    const bbox = [
                        west.toFixed(6),
                        south.toFixed(6),
                        east.toFixed(6),
                        north.toFixed(6),
                    ].join(",");

                    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(`${latNum},${lonNum}`)}&zoom=${zoom}`;
                }
            }
        } catch (_) {
            // Fall through to generic embed.
        }

        return "https://www.openstreetmap.org/export/embed.html?layer=mapnik";
    }

    private clampLat(value: number): number {
        return Math.max(-85.051129, Math.min(85.051129, value));
    }

    private clampLon(value: number): number {
        return Math.max(-180, Math.min(180, value));
    }

    private clampZoom(value: string): string {
        const num = Number(value);
        if (Number.isNaN(num))
            return "12";

        return Math.max(0, Math.min(19, Math.round(num))).toString();
    }
}
