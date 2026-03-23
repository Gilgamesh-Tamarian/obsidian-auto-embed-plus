import { App, Modal } from "obsidian";
import { createAspectRatioInput } from "./components/aspect_ratio_input";
import { createIframeContainerEl, createIframeContainerElLegacy } from "./components/resizable_iframe_container";
import { doesSupportAspectRatio } from "./constant";

function hasIframeMarkup(markup: string): boolean {
const fragment = document.createElement("template");
fragment.innerHTML = markup.trim();

const rootEl = fragment.content.firstElementChild as HTMLElement | null;
if (!rootEl)
return false;

return rootEl instanceof HTMLIFrameElement || !!rootEl.querySelector("iframe");
}

function createGenericEmbedPreview(contentEl: HTMLElement, embedHtml: string) {
const previewContainer = contentEl.createEl("div");
previewContainer.className = "iframe__container space-y";
previewContainer.innerHTML = embedHtml.trim();

return {
previewEl: previewContainer,
outputHtml: () => embedHtml,
};
}

export class ConfigureIframeModal extends Modal {
iframeHtml: string;
editor: any;

constructor(app: App, iframeHtml: string, editor: any) {
super(app);
this.iframeHtml = iframeHtml;
this.editor = editor;

// Allow the modal to grow in width
this.containerEl.className += " iframe__modal";
}

onOpen() {
this.titleEl.textContent = "Configure embed";
const { contentEl } = this;

const container = contentEl.createEl("div");
container.className = "iframe__modal__container";

const subTitle = contentEl.createEl("div");
const outdatedObsidianWarning = doesSupportAspectRatio ? "" : "</br><strong>For the best experience, please re-download Obsidian to get the latest Electron version</strong>.";
const isIframeEmbed = hasIframeMarkup(this.iframeHtml);

let previewEl: HTMLElement;
let outputHtml: () => string;

if (isIframeEmbed) {
subTitle.innerHTML = "To choose the size, drag the <strong>bottom right</strong> (the preview won't respect the note width)." + outdatedObsidianWarning;

// Electron < 12 doesn't support the aspect ratio. We need to use a fancy div container with a padding bottom
const { iframeContainer, outputHtml: buildHtml, resetToDefaultWidth, updateAspectRatio } = doesSupportAspectRatio ?
createIframeContainerEl(contentEl, this.iframeHtml) : createIframeContainerElLegacy(contentEl, this.iframeHtml);
const widthCheckbox = createShouldUseDefaultWidthButton(container, resetToDefaultWidth);
const aspectRatioInput = createAspectRatioInput(container, updateAspectRatio);

previewEl = iframeContainer;
outputHtml = buildHtml;

container.appendChild(aspectRatioInput);
container.appendChild(widthCheckbox);
} else {
subTitle.innerHTML = "This provider uses native markup instead of an iframe, so there are no iframe sizing controls for this preview.";

const genericPreview = createGenericEmbedPreview(contentEl, this.iframeHtml);
previewEl = genericPreview.previewEl;
outputHtml = genericPreview.outputHtml;
}

const buttonContainer = contentEl.createEl("div");
buttonContainer.className = "button__container space-y";

const cancelButton = buttonContainer.createEl("button");
cancelButton.setText("Cancel");
cancelButton.onclick = (e) => {
e.preventDefault();
this.close();
};

const okButton = buttonContainer.createEl("button");
okButton.setText("OK");
okButton.className = "mod-cta";
okButton.onclick = (e) => {
e.preventDefault();

this.editor.replaceSelection(outputHtml());
this.close();
};

container.appendChild(subTitle);
container.appendChild(previewEl);
container.appendChild(buttonContainer);
contentEl.appendChild(container);
}

onClose() {
const { contentEl } = this;
contentEl.empty();
}
}

export function createShouldUseDefaultWidthButton(container: HTMLElement, onClick: () => void): HTMLDivElement {
const name = "shouldUseDefaultWidth";
const checkboxContainer = container.createEl("div");
checkboxContainer.className = "space-y"

const label = checkboxContainer.createEl("button");
label.setAttribute("for", name);
label.innerText = "Match the note width (reset the size)";

label.onclick = onClick;

return checkboxContainer;
}
