import { requestUrl } from "obsidian";
import AutoEmbedPlugin from "src/main";
import { PreloadOptions, SupportedWebsites } from "src/settings-tab";
import { Dictionary, Size } from "src/utility";
import { setCssProps } from "../utility";

export class BaseEmbedData {
    embedSource: EmbedBase;
    // TODO: Add url
    originalString?: string;
    shouldEmbed: boolean;
    alt?: string;
    width?: string;
    height?: string;
    
    embedIframeEl: HTMLIFrameElement;
    embedContainer: HTMLDivElement;

    constructor(embedSource: EmbedBase, originalString: string) {
        this.embedSource = embedSource;
        this.originalString = originalString;
        this.shouldEmbed = true;
    }
}

export interface EmbedResult {
    embedData: BaseEmbedData;

    containerEl: HTMLDivElement;
    embed: HTMLElement;
    iframeEl?: HTMLIFrameElement;
    placeholderEl?: HTMLDivElement;
}

interface EmbedIframeConfig {
    src: string;
    parent?: HTMLElement;
    containerClass?: string;
    classNames?: string[];
    dataset?: Record<string, string | undefined>;
    scrolling?: string;
    allow?: string;
    allowFullscreen?: boolean;
    sandbox?: string[];
    styles?: Record<string, string>;
    cacheKey?: string;
    cacheWidth?: boolean;
}

export abstract class EmbedBase {
    readonly autoEmbedCssClass: string = "auto-embed";
    readonly name: SupportedWebsites | "Other" | "Fallback";
    // To identify if the anchor link matches the embed type
    readonly regex: RegExp; 
    // Embed websites usually post a resize message.
    // This is to identify which website sent the message. 
    // If the website doesn't need / doesn't send the message, it'll be undefined.
    readonly embedOrigin?: string;
    readonly plugin: AutoEmbedPlugin;
    // Cache the height of the embed. 
    // Correctly sizes the embeds that it has seen before as soon as the embed is loaded. Reducing Cumulative Layout Shift.
    // Helps also when some websites don't send the resize message for some reason.
    sizeCache: Dictionary<Size>; 
    
    constructor(plugin: AutoEmbedPlugin) {
        this.plugin = plugin;
        this.sizeCache = {};
    }

    protected createEmbedIframe(config: EmbedIframeConfig): HTMLIFrameElement {
        const iframe = config.parent
            ? createEl("iframe", { parent: config.parent })
            : createEl("iframe");

        iframe.src = config.src;
        iframe.classList.add(this.autoEmbedCssClass, ...(config.classNames ?? []));

        if (config.containerClass)
            iframe.dataset.containerClass = config.containerClass;

        if (config.dataset) {
            Object.entries(config.dataset).forEach(([key, value]) => {
                if (value !== undefined)
                    iframe.dataset[key] = value;
            });
        }

        if (config.scrolling)
            iframe.setAttribute("scrolling", config.scrolling);

        if (config.allow)
            iframe.setAttribute("allow", config.allow);

        if (config.allowFullscreen)
            iframe.setAttribute("allowfullscreen", "");

        if (config.sandbox?.length)
            iframe.sandbox.add(...config.sandbox);

        if (config.styles)
            setCssProps(iframe, config.styles);

        if (config.cacheKey)
            this.applyCachedSize(iframe, config.cacheKey, config.cacheWidth);

        return iframe;
    }

    protected applyCachedSize(iframe: HTMLIFrameElement, cacheKey: string, includeWidth = false): void {
        const cachedSize = this.sizeCache[cacheKey];
        if (!cachedSize)
            return;

        if (cachedSize.height)
            setCssProps(iframe, { height: `${cachedSize.height}px` });

        if (includeWidth && cachedSize.width)
            setCssProps(iframe, { width: `${cachedSize.width}px` });
    }

    protected cacheSize(cacheKey: string, height: number, width = 0): void {
        this.sizeCache[cacheKey] = { width, height };
    }

    validateUrl(_link: string): Promise<boolean> {
        return Promise.resolve(true);
    }
    
    abstract createEmbed(link: string, embedData?: BaseEmbedData): HTMLElement;

    create(link: string, embedData: BaseEmbedData, forNoteExport = false): EmbedResult {
        if (!window.navigator.onLine) {
            const container = createDiv({cls: ["auto-embed-container", this.autoEmbedCssClass]});
            const embed = container.appendChild(this.onNoInternetConnection());
            return {
                embedData: embedData,
                containerEl: container,
                embed: embed
            }
        }

        const embed = this.createEmbed(link, embedData);
        let embedClass: string;
        if (embedData.embedSource.name === "Fallback")
            embedClass = "default-fallback-embed-container";
        else if (embed.dataset.containerClass)
            embedClass = embed.dataset.containerClass;
        else
            embedClass = "auto-embed-unknown-class";

        // Add create container, add embed
        const container = createDiv({cls: ["auto-embed-container", embedClass]});
        container.appendChild(embed);
        
        if (!forNoteExport) {
            // Runtime-only behavior in reading/live preview.
            requestUrl({url: link, method: "HEAD"}).then(res => {
                if (res.headers["content-type"].startsWith("image"))
                {
                    container.classList.add("auto-embed-hide-display");
                    container.parentElement?.removeChild(container);
                }
            }).catch(() => undefined);
        }

        if (embed.classList.contains("error-embed")) {
            console.debug("Container:", embedData.embedContainer);
            return { 
                embedData: embedData, 
                containerEl: container,
                embed: embed,
            };
        }
        
        const iframe = embed instanceof HTMLIFrameElement
            ? embed
            : (embed.querySelector(':scope > iframe') as HTMLIFrameElement | null);

        // Add placeholder
        let placeholder: HTMLDivElement | undefined;
        const hideClass = "auto-embed-hide-visibility";

        // Called twice at different times. So put it out in a function
        function AddOnLoadEvent(iframe: HTMLIFrameElement) {
            function ShowEmbed_HidePlaceholder() {
                embed.classList.remove(hideClass);
                placeholder?.classList.add(hideClass);
            }

            iframe?.addEventListener("load", ShowEmbed_HidePlaceholder);
            container.addEventListener("auto-embed-error", ShowEmbed_HidePlaceholder);
            container.addEventListener("auto-embed-loaded", ShowEmbed_HidePlaceholder);
        }

        if (iframe && !forNoteExport && this.plugin.settings.preloadOption !== PreloadOptions.None)
        {
            placeholder = this.generatePlaceholder(link);
            container.appendChild(placeholder);
            
            embed.classList.add(hideClass);

            if (this.plugin.settings.preloadOption === PreloadOptions.Placeholder_ClickToLoad) {
                // Prevent the iframe from loading. Store the url in the dataset
                iframe.dataset.src = iframe.src;
                iframe.src = "about:blank"; 

                placeholder.addEventListener("click", () => {
                    placeholder?.classList.toggle("auto-embed-click-to-load", false);

                    // Show loader
                    const loader = placeholder?.querySelector(".auto-embed-loader");
                    if (loader) 
                        loader.classList.toggle(hideClass, false);

                    const status = placeholder?.querySelector(".auto-embed-placeholder-status");
                    if (status) 
                        status.textContent = "Loading embed...";
                    
                    if (!iframe.dataset.src)
                    {
                        console.error("iframe.dataset.src is not set");
                        return;
                    }

                    iframe.src = iframe.dataset.src;
                    AddOnLoadEvent(iframe);
                })
            }
            else {
                // Show loader
                const loader = placeholder?.querySelector(".auto-embed-loader");
                if (loader) 
                    loader.classList.toggle(hideClass, false);
                AddOnLoadEvent(iframe);
            }
        } else if (!iframe) {
            container.addEventListener("auto-embed-loaded", () => {
                embed.classList.remove(hideClass);
            });
        }

        return {
            embedData: embedData,
            containerEl: container,
            embed: embed,
            iframeEl: iframe ?? undefined,
            placeholderEl: placeholder
        }
    }

    getOptions(alt: string): BaseEmbedData {
        const options: BaseEmbedData = new BaseEmbedData(this, alt);

        if (!alt)
            return options;

        // Don't need to check the rest since not embedding.
        if (alt.match(/noembed/)) {
            options.shouldEmbed = false;
            return options;
        }
        else {
            options.shouldEmbed = true;
        }

        options.alt = alt;

        // TODO Options: 
        // - Size: Set both height and width at the same time. [size:100x200]

        // TODO: Optimise this? If there are alot of options, it might be slow.
        const widthMatch = alt.match(/(?:w|width)\s*(?::|=)\s*(\d+(?:%|\w+))/);
        if (widthMatch) {
            options.width = widthMatch[1];
            options.alt = options.alt.replace(widthMatch[0], "");
        }

        const heightMatch = alt.match(/(?:h|height)\s*(?::|=)\s*(\d+(?:%|\w+))/);
        if (heightMatch) {
            options.height = heightMatch[1];
            options.alt = options.alt.replace(heightMatch[0], "");
        }

        return options;
    }

    applyModifications(embedResult: EmbedResult, data: BaseEmbedData) {
        // Applying attributes. Do here to avoid repeating this code
        // console.log("Tagname: " + el.tagName)
        if (embedResult.iframeEl) {
            if (this.plugin.settings.preloadOption !== PreloadOptions.Placeholder_ClickToLoad)
                embedResult.iframeEl.setAttribute("loading", "lazy");
            
            embedResult.iframeEl.setAttribute("allowfullscreen", "true");
            embedResult.iframeEl.setAttribute("allowtransparency", "true");
        }

        // Applying options
        if (data.width)
            setCssProps(embedResult.containerEl, { width: data.width });
        
        if (data.height) {
            setCssProps(embedResult.containerEl, { height: data.height });
        }
    }

    // For when the iframe is still loading
    generatePlaceholder(link: string) : HTMLDivElement {
        const isClickToLoad = this.plugin.settings.preloadOption === PreloadOptions.Placeholder_ClickToLoad;
        const container = createDiv(
            {
                cls: `auto-embed-placeholder ${isClickToLoad ? "auto-embed-click-to-load":""}`, 
                title: link
            });
        
        createSpan( 
            {
                parent: container, 
                text: isClickToLoad ? "Click to load embed" : "Loading embed...", 
                cls: "auto-embed-placeholder-status"
            });

        createSpan({cls: "auto-embed-loader auto-embed-hide-visibility", parent: container});
        
        createEl("p", 
            {
                parent: container, 
                text: `Link: ${link}`, 
                cls: "auto-embed-placeholder-link"
            });

        return container;
    }

    // afterInsertingToDOM?(embed: HTMLElement): void;
    
    // To have a embed source respond to the resize event:
    // - Set EmbedBase.embedOrigin (e.g. embedOrigin = "https://platform.twitter.com")
    // - Implement body of resize method here (onResizeMessage)
    // - Remember to resize the container too! Call this.resizeContainer()
    onResizeMessage?(e: MessageEvent): void;

    resizeContainer(el: HTMLElement, height?: string, width?: string) {
        // Quick way to resize container. A better way might be to pass EmbedResult
        if (height && el.parentElement)
            setCssProps(el.parentElement, { height });
        
        if (width && el.parentElement)
                setCssProps(el.parentElement, { width });
    }

    // ===== ERRORS =====
    onErrorCreatingEmbed(url: string, msg?: string): HTMLElement {
        const errorMsg = (msg ?? `Error with ${this.name} URL.`) + `\nURL: ${url}`;
        const error = createEl("p", {cls: `${this.autoEmbedCssClass} error-embed`});
        error.setText(errorMsg);

        console.error("auto-embed/error: " + errorMsg);
        return error;
    }

    onNoInternetConnection(): HTMLElement {
        console.error("auto-embed/error: no internet connection");

        return createEl("p", {cls: `${this.autoEmbedCssClass} embed-no-connection`, text: "No internet connection"});
    }
}