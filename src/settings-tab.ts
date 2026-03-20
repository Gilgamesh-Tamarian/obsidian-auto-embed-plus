import AutoEmbedPlugin from "src/main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { PreviewEmbedModal } from "src/preview-embed-modal";
import { setCssProps } from "./utility";

export enum FallbackOptions {
    ShowErrorMessage,
    EmbedLink,
    Hide,
}

export enum GoogleDocsViewOptions {
    Preview,
    EditMinimal,
    EditDefault,
}

export enum PreloadOptions {
    None,
    Placeholder,
    Placeholder_ClickToLoad,
}

const supportedWebsites = [
    "Twitter/X",
    "Imgur",
    "Reddit",
    "CodePen",
    "Google Docs",
    "SoundCloud",
    "Spotify",
    "Steam",
    "TikTok",
    "Instagram",
    "Mastodon"
] as const;

export type SupportedWebsites = (typeof supportedWebsites)[number];

export type SupportedWebsitesMap = {
    [key in SupportedWebsites]: boolean
};

export interface PluginSettings {

    // General
    darkMode: boolean;
    preloadOption: PreloadOptions;
    suggestEmbed: boolean;

    enabledWebsites: SupportedWebsitesMap;

    // Mastodon instances
    mastodonInstances: string[];
    // Mastodon default embed height
    mastodonDefaultHeight: string;

    // Google Docs
    googleDocsViewOption: GoogleDocsViewOptions;

    // Fallback
    fallbackOptions: FallbackOptions;
    fallbackWidth: string;
    fallbackHeight: string;
    fallbackDefaultLink: string;
    fallbackAutoTitle: boolean;

    // Advanced
    showAdvancedSettings: boolean;
    debug: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    darkMode: true,
    preloadOption: PreloadOptions.Placeholder,
    suggestEmbed: true,

    enabledWebsites: ResetEnabledWebsites(),

    mastodonInstances: [],
    mastodonDefaultHeight: "1000",

    googleDocsViewOption: GoogleDocsViewOptions.Preview,

    fallbackOptions: FallbackOptions.EmbedLink,
    fallbackWidth: "100%",
    fallbackHeight: "500px",
    fallbackDefaultLink: "Link",
    fallbackAutoTitle: true,

    showAdvancedSettings: false,
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

        function ValidateSettings(setting: PluginSettings, plugin: AutoEmbedPlugin) {

            if (setting.enabledWebsites && Object.keys(setting.enabledWebsites).length > 0) {

                const newWebsites = supportedWebsites.filter(
                    website => setting.enabledWebsites[website] === undefined
                );

                if (newWebsites.length > 0) {
                    newWebsites.forEach(
                        website => setting.enabledWebsites[website] = true
                    );
                    void plugin.saveSettings();
                }

            } else {

                setting.enabledWebsites = ResetEnabledWebsites();
                void plugin.saveSettings();

            }
        }

        ValidateSettings(settings, plugin);

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

        function AddPadding(setting: Setting, addBottomBorder = false) {

                setCssProps(setting.settingEl, {
                    paddingLeft: "2em",
                    borderLeft: "1px solid var(--background-modifier-border)"
                });

                if (addBottomBorder) {
                    setCssProps(setting.settingEl, {
                        borderBottom: "1px solid var(--background-modifier-border)"
                    });
                }
        }

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
            .setName("Suggest embed")
            .setDesc("Suggest embedding when pasting a link")
            .addToggle(toggle => toggle
                .setValue(settings.suggestEmbed)
                .onChange(async value => {

                    settings.suggestEmbed = value;

                    if (value)
                        plugin.registerSuggest();

                    await plugin.saveSettings();

                }));

        new Setting(containerEl)
            .setName("Supported websites")
            .setHeading()
            .setDesc("Enable or disable embed support for specific websites");

        for (const website in settings.enabledWebsites) {

            const websiteSetting =
                new Setting(containerEl)
                    .setName(website)
                    .addToggle(toggle => toggle
                        .setValue(settings.enabledWebsites[website as SupportedWebsites])
                        .onChange(async value => {

                            settings.enabledWebsites[website as SupportedWebsites] = value;
                            await plugin.saveSettings();

                        }));

            AddPadding(websiteSetting, true);
        }

        /*
        Mastodon instance settings
        */

        new Setting(containerEl)
            .setName("Mastodon instances")
            .setHeading()
            .setDesc("Enter mastodon servers that should be recognized as embeds (one per line). \nNote: mastodon.social is always allowed regardless of settings");

        new Setting(containerEl)
            .setName("Allowed mastodon servers")
            .addTextArea(text => {

                text
                    .setPlaceholder(
                        "E.g. social.vivaldi.net\nlgbtqia.space\npiaille.fr"
                    )
                    .setValue(settings.mastodonInstances.join("\n"))
                    .onChange(async value => {

                        settings.mastodonInstances =
                            value
                                .split("\n")
                                .map(v => v.trim())
                                .filter(v => v.length > 0);

                        await plugin.saveSettings();

                    });

                text.inputEl.rows = 6;

            });

        new Setting(containerEl)
            .setName("Mastodon default embed height")
            .setDesc("Set the default height (in px) for mastodon embeds. Standard default: 750.\n\nA larger default height is necessary to correctly render longer posts, but will result in excessive space for smaller posts. You can manually adjust the height for individual embeds if needed.")
            .addText(text => {
                text.setValue(settings.mastodonDefaultHeight)
                    .onChange(async value => {
                        settings.mastodonDefaultHeight = value;
                        await plugin.saveSettings();
                    });
            });

        const additionalInfo = new DocumentFragment();

        additionalInfo.appendText("All values use ");
        additionalInfo.appendChild(createEl("a", {
            text: "CSS units",
            href: "https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units#numbers_lengths_and_percentages"
        }));

        additionalInfo.appendChild(createEl("br"));
        additionalInfo.appendText("Reload notes to apply changes.");

        additionalInfo.appendChild(createEl("br"));
        additionalInfo.appendChild(createEl("br"));

        additionalInfo.appendText("Found bugs or want a feature?");
        additionalInfo.appendChild(createEl("br"));

        additionalInfo.appendChild(createEl("a", {
            text: "Create a GitHub issue",
            href: "https://github.com/Gilgamesh-Tamarian/obsidian-auto-embed-plus/issues/new"
        }));

        new Setting(containerEl)
            .setDesc(additionalInfo);
    }
}

function ResetEnabledWebsites(): SupportedWebsitesMap {

    return Object.fromEntries(
        supportedWebsites.map(website => [website, true])
    ) as SupportedWebsitesMap;

}
