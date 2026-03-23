import { hasProvider, extract, VideoTypeData} from 'oembed-parser'
import * as DOMPurify from 'dompurify'


export interface IframeFallbackOptions {
    enableIframelyFallback?: boolean;
    iframelyApiKey?: string;
}

export type IframelyHtmlFetcher = (url: string, apiKey: string) => Promise<string | null>;


const buildDefaultIframe = (url: string) => {
    return `<iframe src="${url}" allow="fullscreen" allowfullscreen style="height:100%;width:100%; aspect-ratio: 16 / 9; "></iframe>`
}

const extractIframelyHostedIframe = (html: string): string | null => {
    const match = html.match(/data-iframely-url="([^"]+)"/i);
    const iframeUrl = match?.[1];

    if (!iframeUrl) {
        return null;
    }

    return `<iframe src="${iframeUrl}" allow="fullscreen" allowfullscreen style="height:100%;width:100%; aspect-ratio: 16 / 9; "></iframe>`;
}

export const getIframeGeneratorFromSanitize = (
    sanitize: typeof DOMPurify.sanitize,
) => async (
    url: string,
    options?: IframeFallbackOptions,
    fetchIframelyHtml?: IframelyHtmlFetcher,
): Promise<string> => {
    const defaultHtml = buildDefaultIframe(url);
    const cleanedIframelyKey = options?.iframelyApiKey?.trim();

    if (hasProvider(url)) {
        try {
            // Get the Oemb
            const oembedData = await extract(url);

            if(oembedData && oembedData.type !== 'rich' && oembedData.type !=='video') {
                throw new Error(`Not a rich or video type: ${JSON.stringify(oembedData)}`)
            }
            
            // Both Rich and Video types have an html property
            const html = (oembedData as VideoTypeData)?.html;

            // We only allow an iframe
            const cleanedHtml = sanitize(html, { ALLOWED_TAGS: ["iframe"]})

            if(cleanedHtml.startsWith('<iframe')) {
                return cleanedHtml
            }

            throw new Error(`Not an iframe, we currently do not support this: ${html}`)
        } catch (e) {
            console.warn(`Could not get oembed data for ${url}`, e);
        }
    }

    if (options?.enableIframelyFallback && cleanedIframelyKey && fetchIframelyHtml) {
        try {
            const iframelyHtml = await fetchIframelyHtml(url, cleanedIframelyKey);
            if (iframelyHtml) {
                const cleanedHtml = sanitize(iframelyHtml, { ALLOWED_TAGS: ["iframe"]});

                if (cleanedHtml.startsWith('<iframe')) {
                    return cleanedHtml;
                }

                const hostedIframe = extractIframelyHostedIframe(iframelyHtml);
                if (hostedIframe) {
                    return hostedIframe;
                }
            }
        } catch (e) {
            console.warn(`Could not get Iframely data for ${url}`, e);
        }
    }

    return defaultHtml
}

const boundSanitize: typeof DOMPurify.sanitize = DOMPurify.sanitize.bind(DOMPurify);
export const getIframe = getIframeGeneratorFromSanitize(boundSanitize);

