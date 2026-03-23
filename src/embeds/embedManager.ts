import AutoEmbedPlugin from "src/main";
import { BaseEmbedData, EmbedBase } from "./embedBase";
import { TwitterEmbed, MastodonEmbed, ThreadsEmbed } from "./microblogging";
import { RedditEmbed, InstagramEmbed, TikTokEmbed, FacebookEmbed, PinterestEmbed, TelegramEmbed } from "./social";
import { SteamEmbed, ImgurEmbed, GoogleCalendarEmbed, WikipediaEmbed, GeogebraEmbed, QuizletEmbed } from "./misc";
import { CodepenEmbed, GoogleDocsEmbed, GoogleDriveEmbed } from "./devdocs";
import { SoundCloudEmbed, SpotifyEmbed, AppleMusicEmbed, TidalEmbed, DeezerEmbed } from "./media";
import { GoogleMapsEmbed, OpenStreetMapEmbed } from "./maps";
import { DefaultFallbackEmbed } from "./defaultFallbackEmbed";
import { apiVersion } from "obsidian";
import { YouTubeEmbed, VimeoEmbed, DailymotionEmbed, VKVideoEmbed, TwitchEmbed } from "./video";

export class EmbedManager {
    // Singleton
    // Not sure how to share plugin class with the embed state field without singleton
    private static _instance: EmbedManager;

    private constructor() { }

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    plugin: AutoEmbedPlugin;
    embedSources: EmbedBase[];
    ignoredDomains: RegExp[];
    defaultFallbackEmbed: DefaultFallbackEmbed;

    init(plugin: AutoEmbedPlugin) {
        this.plugin = plugin;
        // Add any new embeds here
        this.embedSources = [
            new YouTubeEmbed(plugin),
            new VimeoEmbed(plugin),
            new DailymotionEmbed(plugin),
            new VKVideoEmbed(plugin),
            new TwitchEmbed(plugin),
            new RedditEmbed(plugin),
            new SteamEmbed(plugin),
            new GoogleCalendarEmbed(plugin),
            new WikipediaEmbed(plugin),
            new GeogebraEmbed(plugin),
            new QuizletEmbed(plugin),
            new GoogleMapsEmbed(plugin),
            new OpenStreetMapEmbed(plugin),
            new CodepenEmbed(plugin),
            new GoogleDriveEmbed(plugin),
            new SpotifyEmbed(plugin),
            new AppleMusicEmbed(plugin),
            new TidalEmbed(plugin),
            new DeezerEmbed(plugin),
            new ImgurEmbed(plugin),
            new GoogleDocsEmbed(plugin),
            new TikTokEmbed(plugin),
            new SoundCloudEmbed(plugin),
            new InstagramEmbed(plugin),
            new FacebookEmbed(plugin),
            new PinterestEmbed(plugin),
            new TelegramEmbed(plugin),
			new MastodonEmbed(plugin),
            new ThreadsEmbed(plugin),

        ];

        // Keep Twitter handling compatible with Obsidian's native support split.
        this.ignoredDomains = [
            // Intentionally empty for now.
        ];


        // Obsidian starts supporting x.com embeds from version 1.7.0 onwards. 
        // So, check which version the user is currently on, then 
        // If user is on 1.7.0 and up, 
        //      Don't embed Twitter & X
        // Else
        //      Don't embed Twitter only
        const apiVersionSplit = apiVersion.split(".");
        const majorVersion = parseInt(apiVersionSplit[0]);
        const minorVersion = parseInt(apiVersionSplit[1]);

        if (majorVersion > 1 || 
            (majorVersion === 1 && minorVersion >= 7)) {
                // Ignore twitter & X
                this.ignoredDomains.push(new RegExp(/https:\/\/(?:twitter|x)\.com/))
            }
        else {
            this.embedSources.push(new TwitterEmbed(plugin));
            // Ignore twitter only
            this.ignoredDomains.push(new RegExp(/https:\/\/(?:twitter)\.com/));
        }

        this.defaultFallbackEmbed = new DefaultFallbackEmbed(plugin);
    }

    // Gets the embed source for the url
    // Returns null if it can't / shouldn't be embedded.
    static getEmbedData(url: string, alt: string): BaseEmbedData | null{
        const domain = this._instance.ignoredDomains.find(domain => {
            return domain.test(url);
        });
        // If found a domain in the ignored domains, return
        if (domain) {
            return null;
        }

        const embedSource = this._instance.embedSources.find((source) => {
            return source.regex.test(url);
        }) ?? this._instance.defaultFallbackEmbed;

        const options = embedSource.getOptions(alt);

        if (!options.shouldEmbed)
            return null;

        return options;
    }
}
