import { defaultHeight } from "src/constant";
import { setCssProps } from "src/utility";
import { AspectRatioType } from "src/types/aspect-ratio";
import { swapRatio } from "src/utils/ratio.utils";
import { getAutoAspectRatioForUrl } from "src/utils/native_embed_markup.utils";

export interface IResizableIframeContainerOutput {
    iframeContainer: HTMLElement,
    outputHtml: () => string,
    updateAspectRatio: (aspectRatio: AspectRatioType) => void,
    resetToDefaultWidth: () => void,
}


export function createIframeContainerEl(contentEl: HTMLElement, iframeHtml: string): IResizableIframeContainerOutput{
	// Container to keep a min height for the iframe to keep the content visible
	const iframeContainer = contentEl.createEl('div');
	iframeContainer.className = "iframe__container space-y"

	// Inline styling to make sure that the created iframe will keep the style even without the plugin
	const fragment = document.createElement('template');
	fragment.innerHTML = iframeHtml.trim();

	const rootEl = fragment.content.firstElementChild as HTMLElement | null;
	if (!rootEl) {
		throw new Error('Embed markup does not contain a root element');
	}

	const iframe = rootEl instanceof HTMLIFrameElement
		? rootEl
		: (rootEl.querySelector('iframe') as HTMLIFrameElement | null);

	if (!iframe) {
		throw new Error('Embed markup does not contain an iframe');
	}

	iframeContainer.appendChild(rootEl);
	const defaultAspectRatio = iframe.style.getPropertyValue("aspect-ratio") || iframe.style.aspectRatio;
	const defaultHeight = iframe.style.getPropertyValue("height") || iframe.style.height;
	const defaultMinHeight = iframe.style.getPropertyValue("min-height") || iframe.style.minHeight;

	const applyDefaultSizing = () => {
		setCssProps(iframe, { width: "100%" });

		if (defaultAspectRatio) {
			setCssProps(iframe, { aspectRatio: defaultAspectRatio });
		} else {
			iframe.style.removeProperty("aspect-ratio");
		}

		if (defaultHeight) {
			setCssProps(iframe, { height: defaultHeight });
		} else {
			iframe.style.removeProperty("height");
		}

		if (defaultMinHeight) {
			setCssProps(iframe, { minHeight: defaultMinHeight });
		} else {
			iframe.style.removeProperty("min-height");
		}
	};

	const resetToDefaultWidth = () => {
		applyDefaultSizing();
	};
	
	resetToDefaultWidth();

	// Always allow full screen
	// TODO make it an option
	iframe.allowFullscreen = true;
	iframe.allow= 'fullscreen'

	return {
        iframeContainer,
        updateAspectRatio: (value) => {
            if (value === "auto") {
				applyDefaultSizing();
				return;
			}

			setCssProps(iframe, { width: "100%" });
			iframe.style.removeProperty("height");

			if (defaultMinHeight) {
				setCssProps(iframe, { minHeight: defaultMinHeight });
			} else {
				iframe.style.removeProperty("min-height");
			}

			if (value === "none") {
				iframe.style.removeProperty("aspect-ratio");
				return;
			}

			setCssProps(iframe, { aspectRatio: value });
        },
        outputHtml: () => {
				return rootEl.outerHTML;

        },
        resetToDefaultWidth,
	};
}

// Electron < 12 doesn't support the aspect ratio. We need to use a fancy div container with a padding bottom
	export function createIframeContainerElLegacy(contentEl: HTMLElement, iframeHtml: string): IResizableIframeContainerOutput{
	// Inline styling to make sure that the created iframe will keep the style even without the plugin

	// This container can be resized
	const iframeContainer = contentEl.createEl('div');
	iframeContainer.className = "iframe__container__legacy space-y"
	setCssProps(iframeContainer, {
		overflow: 'auto',
		resize: 'both',
		height: defaultHeight,
	});

	// This container enforce the aspect ratio. i.e. it's height is based on the width * ratio
	const ratioContainer = iframeContainer.createEl('div');
	setCssProps(ratioContainer, {
		display: 'block',
		position: 'relative',
		width: '100%',
	});
	// The height is determined by the padding which respect the ratio
	// See https://www.benmarshall.me/responsive-iframes/
	setCssProps(ratioContainer, {
		height: "0px",
		'--aspect-ratio': '9/16',
		paddingBottom: 'calc(var(--aspect-ratio) * 100%)',
	});

	const iframe = ratioContainer.createEl('iframe');

	const fragment = document.createElement('template');
	fragment.innerHTML = iframeHtml.trim();
	const sourceIframe = fragment.content.querySelector('iframe');
	const sourceUrl = sourceIframe?.getAttribute("src") ?? "about:blank";
	const autoAspectRatio = getAutoAspectRatioForUrl(sourceUrl);
	iframe.src = sourceIframe?.getAttribute('src') ?? 'about:blank';
	iframe.allow = "fullscreen"
	setCssProps(iframe, {
		position: 'absolute',
		top: '0px',
		left: '0px',
		height: '100%',
		width: '100%',
	});

	const resolvedInitialRatio = autoAspectRatio === "none" ? "16/9" : autoAspectRatio;
	setCssProps(ratioContainer, { '--aspect-ratio': swapRatio(resolvedInitialRatio) });

	// Recompute the iframe height with the ratio to avoid any empty space
	setCssProps(iframeContainer, { height: `${ratioContainer.offsetHeight}px` });

	return {
        iframeContainer,
        updateAspectRatio: (value) => {
			const resolvedValue = value === "auto" ? autoAspectRatio : value;

			if (resolvedValue === 'none') {
				setCssProps(ratioContainer, {
					paddingBottom: '0px',
					height: '100%',
				});
            } else {
				setCssProps(ratioContainer, {
					paddingBottom: 'calc(var(--aspect-ratio) * 100%)',
					height: '0px',
					'--aspect-ratio': swapRatio(resolvedValue),
				});
            }
        },
        outputHtml: () => {
			iframeContainer.className = "";
			// Recompute the height to remove the possible empty space
			setCssProps(iframeContainer, { height: `${ratioContainer.offsetHeight}px` });
			return ratioContainer.outerHTML;

        },
        resetToDefaultWidth: () => {

			setCssProps(iframeContainer, {
				width: '100%',
				height: `${ratioContainer.offsetHeight}px`,
			});
        },
	};
}
