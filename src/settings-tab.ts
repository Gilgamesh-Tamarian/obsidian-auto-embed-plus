import AutoEmbedPlugin from "src/main";
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { PreviewEmbedModal } from "src/preview-embed-modal";

export enum PreloadOptions {
    None,
    Placeholder,
    Placeholder_ClickToLoad,
}

export const supportedWebsites = [
    "Twitter/X",
    "Imgur",
    "Reddit",
    "CodePen",
    "Google Docs",
    "Google Drive",
    "Google Calendar",
    "Google Maps",
    "Wikipedia",
    "Geogebra",
    "Quizlet",
    "OpenStreetMap",
    "SoundCloud",
    "Spotify",
    "Apple Music",
    "Tidal",
    "Deezer",
    "Steam",
    "YouTube",
    "Vimeo",
    "Dailymotion",
    "VK Video",
    "Twitch",
    "TikTok",
    "Instagram",
    "Facebook",
    "Pinterest",
    "Telegram",
    "Mastodon",
    "Threads",
] as const;

export type SupportedWebsites = (typeof supportedWebsites)[number];

export interface PluginSettings {

    // General
    darkMode: boolean;
    preloadOption: PreloadOptions;
    showOriginalLink: boolean;

    // Download from embed
    saveImagesToVault: boolean;
    saveSocialMediaImagesToVault: boolean;
    imageFolderPath: string;
    googleDocsFolderPath: string;
    saveGoogleDocsToVault: boolean;
    saveQuizletCardsToVault: boolean;
    saveQuizletImagesToVault: boolean;
    saveQuizletAsSeparateNotes: boolean;
    quizletFolderPath: string;

    // Advanced
    debug: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    darkMode: true,
    preloadOption: PreloadOptions.Placeholder,
    showOriginalLink: true,

    saveImagesToVault: false,
    saveSocialMediaImagesToVault: false,
    imageFolderPath: "linked-iframe-images",
    googleDocsFolderPath: "linked-iframe-docs",
    saveGoogleDocsToVault: false,
    saveQuizletCardsToVault: false,
    saveQuizletImagesToVault: false,
    saveQuizletAsSeparateNotes: false,
    quizletFolderPath: "linked-iframe-quizlet",

    debug: false,
}

export class AutoEmbedSettingTab extends PluginSettingTab {

    plugin: AutoEmbedPlugin;

    constructor(app: App, plugin: AutoEmbedPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {

        const {containerEl} = this;
        const plugin = this.plugin;
        const settings = plugin.settings;

        containerEl.empty();

        function EnumToRecord<T extends {[key: number]: string | number}>(e: T): Record<string, string>  {

            const recordOutput: Record<string, string> = {};

            for (const option in e) {

                if (!isNaN(Number(option)))
                    continue;

                const displayText =
                    option.replace(
                        /([a-z0-9])([A-Z])/g,
                        (match: string, p1: string, p2: string) =>
                            `${p1} ${p2.toLowerCase()}`
                    );

                recordOutput[option] = displayText;
            }

            return recordOutput;
        }

        function createCollapsibleSection(title: string, description: string): HTMLElement {
            const details = containerEl.createEl("details");
            details.classList.add("auto-embed-settings-section");

            const summary = details.createEl("summary");
            summary.classList.add("auto-embed-settings-section-summary");
            summary.setText(title);

            const desc = details.createDiv("auto-embed-settings-section-desc");
            desc.setText(description);

            return details.createDiv("auto-embed-settings-section-content");
        }

        function addVisualDivider(parent: HTMLElement): void {
            parent.createEl("hr", { cls: "auto-embed-settings-divider" });
        }

        // ── General settings ──────────────────────────────────────────────────

        const previewTooltip = "Opens a modal to test embed links";

        new Setting(containerEl)
            .setName("Preview embed")
            .setTooltip(previewTooltip)
            .addButton(btn => btn
                .setButtonText("Preview")
                .setTooltip(previewTooltip)
                .onClick(() => {
                    const modal =
                        new PreviewEmbedModal(
                            plugin,
                            "https://x.com/obsdmd/status/1739667211462316449"
                        );
                    modal.open();
                }));

        new Setting(containerEl)
            .setName("Dark mode")
            .setDesc("Use dark theme for embeds when supported")
            .addToggle(toggle => toggle
                .setValue(settings.darkMode)
                .onChange(async value => {

                    settings.darkMode = value;
                    await plugin.saveSettings();

                }));

        const preloadOptions = EnumToRecord(PreloadOptions);

        Object.entries(preloadOptions).forEach(([key, value]) => {

            preloadOptions[key] = value.replace("_", " + ");

        });

        new Setting(containerEl)
            .setName("Preload options")
            .setDesc("Choose how the embed behaves before loading")
            .addDropdown(dropdown => dropdown
                .addOptions(preloadOptions)
                .setValue(PreloadOptions[settings.preloadOption])
                .onChange(async value => {

                    settings.preloadOption =
                        PreloadOptions[value as keyof typeof PreloadOptions];

                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Show original link under embed")
            .setDesc("Display an \"Open original link\" footer below generated embeds")
            .addToggle(toggle => toggle
                .setValue(settings.showOriginalLink)
                .onChange(async value => {

                    settings.showOriginalLink = value;
                    await plugin.saveSettings();

                }));

        addVisualDivider(containerEl);

        // ── Generic download settings ──────────────────────────────────────────

        new Setting(containerEl)
            .setName("Save image embeds to vault")
            .setDesc("Download direct image URLs and replace embed links with local vault files")
            .addToggle(toggle => toggle
                .setValue(settings.saveImagesToVault)
                .onChange(async value => {

                    settings.saveImagesToVault = value;
                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Save social media images to vault")
            .setDesc("For supported platforms (Instagram, Facebook, Pinterest, Telegram, Mastodon, Reddit, TikTok, Imgur, SoundCloud, Spotify, CodePen, Steam), fetch available media images and save them locally")
            .addToggle(toggle => toggle
                .setValue(settings.saveSocialMediaImagesToVault)
                .onChange(async value => {

                    settings.saveSocialMediaImagesToVault = value;
                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Save Google Docs to vault")
            .setDesc("Download a local Markdown copy of the document when embedding a Google Doc (requires the document to be shared with anyone with the link)")
            .addToggle(toggle => toggle
                .setValue(settings.saveGoogleDocsToVault)
                .onChange(async value => {

                    settings.saveGoogleDocsToVault = value;
                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Image folder path")
            .setDesc("Folder inside your vault used for downloaded image content")
            .addText(text => text
                .setPlaceholder("linked-iframe-images")
                .setValue(settings.imageFolderPath)
                .onChange(async value => {

                    settings.imageFolderPath = value.trim() || "linked-iframe-images";
                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Google Docs folder path")
            .setDesc("Folder inside your vault used for downloaded Google Docs Markdown files")
            .addText(text => text
                .setPlaceholder("linked-iframe-docs")
                .setValue(settings.googleDocsFolderPath)
                .onChange(async value => {

                    settings.googleDocsFolderPath = value.trim() || "linked-iframe-docs";
                    await plugin.saveSettings();

                }));

        addVisualDivider(containerEl);

        // ── Quizlet settings (collapsible) ────────────────────────────────────

        const quizletContent = createCollapsibleSection(
            "Quizlet",
            "Configure Quizlet card exports and update behavior"
        );

        const quizletModeDescription = new DocumentFragment();
        quizletModeDescription.appendText("When enabled, create one folder per set and one Markdown note per card for ");
        quizletModeDescription.appendChild(createEl("a", {
            text: "Yanki",
            href: "obsidian://show-plugin?id=yanki",
        }));
        quizletModeDescription.appendText(" compatibility. When disabled, save one Markdown file per Quizlet set using the older export format.");

        const quizletSaveDescription = new DocumentFragment();
        quizletSaveDescription.appendText("Best-effort export of public Quizlet flashcards to local Markdown when card data is accessible. ");
        quizletSaveDescription.appendChild(createEl("strong", { text: "Performance warning:" }));
        quizletSaveDescription.appendText(" this setting has general plugin performance implications, and will especially cause stutter when embedding larger Quizlet sets.");

        new Setting(quizletContent)
            .setName("Save Quizlet cards to vault")
            .setDesc(quizletSaveDescription)
            .addToggle(toggle => toggle
                .setValue(settings.saveQuizletCardsToVault)
                .onChange(async value => {

                    settings.saveQuizletCardsToVault = value;
                    await plugin.saveSettings();

                }));

        new Setting(quizletContent)
            .setName("Quizlet: save card images to vault")
            .setDesc("When enabled, download card images found in Quizlet sets and embed them locally in exported notes")
            .addToggle(toggle => toggle
                .setValue(settings.saveQuizletImagesToVault)
                .onChange(async value => {

                    settings.saveQuizletImagesToVault = value;
                    await plugin.saveSettings();

                }));

        new Setting(quizletContent)
            .setName("Quizlet: save as separate notes")
            .setDesc(quizletModeDescription)
            .addToggle(toggle => toggle
                .setValue(settings.saveQuizletAsSeparateNotes)
                .onChange(async value => {

                    settings.saveQuizletAsSeparateNotes = value;
                    await plugin.saveSettings();

                }));

        new Setting(quizletContent)
            .setName("Quizlet folder path")
            .setDesc("Folder inside your vault used for downloaded Quizlet card exports")
            .addText(text => text
                .setPlaceholder("linked-iframe-quizlet")
                .setValue(settings.quizletFolderPath)
                .onChange(async value => {

                    settings.quizletFolderPath = value.trim() || "linked-iframe-quizlet";
                    await plugin.saveSettings();

                }));

        new Setting(quizletContent)
            .setName("Update all saved Quizlet cards")
            .setDesc("Primary action: refresh every Quizlet set that has a stored quizlet:source marker in your vault.")
            .addButton(button => {
                let isUpdating = false;

                button
                    .setButtonText("Update all Quizlet cards")
                    .setCta()
                    .onClick(async () => {
                        if (isUpdating) {
                            return;
                        }

                        isUpdating = true;
                        button.setDisabled(true);
                        button.setButtonText("Updating...");
                        new Notice("I link therefore iframe: updating all saved Quizlet cards...");

                        try {
                            const result = await plugin.updateAllSavedQuizletCards();
                            new Notice(
                                `I link therefore iframe: refreshed ${result.refreshedSetCount}/${result.uniqueSetCount} Quizlet sets (` +
                                `saved ${result.savedCount}, updated ${result.updatedCount}, unchanged ${result.unchangedCount}, ` +
                                `no-cards ${result.noCardsCount}, not-html ${result.notHtmlCount}, errors ${result.errorCount}).`,
                                12000,
                            );
                        } catch {
                            new Notice("I link therefore iframe: failed to update all saved Quizlet cards.");
                        } finally {
                            isUpdating = false;
                            button.setDisabled(false);
                            button.setButtonText("Update all Quizlet cards");
                        }
                    });
            });

        // ── Footer ────────────────────────────────────────────────────────────

        const additionalInfo = new DocumentFragment();

        additionalInfo.appendText("Found bugs or want a feature?");
        additionalInfo.appendChild(createEl("br"));

        additionalInfo.appendChild(createEl("a", {
            text: "Create a GitHub issue",
            href: "https://github.com/Gilgamesh-Tamarian/obsidian-link-iframe/issues/new"
        }));

        new Setting(containerEl)
            .setDesc(additionalInfo);
    }
}
