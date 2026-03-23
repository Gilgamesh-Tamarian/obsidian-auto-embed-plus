import AutoEmbedPlugin from "src/main";
import { MarkdownView, Modal, Setting } from "obsidian";
import { ConfigureIframeModal } from "./configure_iframe_modal";

export class PreviewEmbedModal extends Modal {
    plugin: AutoEmbedPlugin;
    url: string;
    options: string;

    constructor(plugin: AutoEmbedPlugin, url: string, options?: string) {
        super(plugin.app);
        this.plugin = plugin;
        this.url = url;
        this.options = options ?? "";
    }

    async createEmbed(contentEl: HTMLElement): Promise<HTMLElement> {
        const markup = await this.plugin.generateEmbedMarkup(this.url, this.options);

        const fragment = document.createElement("template");
        fragment.innerHTML = markup.trim();
        const rootEl = fragment.content.firstElementChild as HTMLElement | null;
        if (!rootEl) {
            throw new Error("Could not generate embed preview");
        }

        contentEl.appendChild(rootEl);
        return rootEl;
    }

    onOpen(): void {
        const {contentEl} = this;
        this.titleEl.textContent = "Preview embed";

        let currEmbed: HTMLElement | null = null;

        new Setting(contentEl)
            .setName("Preview URL")
            .addText(text => text
                .setValue(this.url)
                .onChange((value) => {
                    this.url = value;
                    if (currEmbed)
                        contentEl.removeChild(currEmbed);

                    void this.createEmbed(contentEl).then((embed) => {
                        currEmbed = embed;
                    });
                }));

        new Setting(contentEl)
            .setName("Preview options")
            .addText(text => text
                .setValue(this.options)
                .onChange((value) => {
                    this.options = value;

                    if (currEmbed)
                        contentEl.removeChild(currEmbed);

                    void this.createEmbed(contentEl).then((embed) => {
                        currEmbed = embed;
                    });
                }))


        contentEl.appendChild(createEl("h3", { text: "Embed" }));
        
        void this.createEmbed(contentEl).then((embed) => {
            currEmbed = embed;
        });

        new Setting(contentEl)
            .setName("Convert URL to embed")
            .setDesc("Open the iframe sizing modal using current values")
            .addButton((button) => {
                button.setButtonText("Open modal").onClick(async () => {
                    const markup = await this.plugin.generateEmbedMarkup(this.url, this.options);
                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    const editor = view?.editor;
                    if (!editor)
                        return;
                    new ConfigureIframeModal(this.app, markup, editor).open();
                });
            });
    }
}