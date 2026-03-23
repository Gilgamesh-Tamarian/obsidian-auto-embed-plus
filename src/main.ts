import { Editor, EditorPosition, MarkdownView, Menu, Notice, Plugin } from 'obsidian';
import { AutoEmbedSettingTab, DEFAULT_SETTINGS, PluginSettings } from 'src/settings-tab';
import {
	isLinkToImage,
	isURL,
	resolveAllSocialMediaImageUrls,
	saveImageUrlToVault,
	saveGoogleDocToVault,
} from 'src/utility';
import { QuizletBulkUpdateResult, saveQuizletSetToVault, updateAllQuizletSetsFromStoredSources } from 'src/utils/quizlet.utils';
import { EmbedManager } from './embeds/embedManager';
import { getIframe } from './utils/iframe_generator.utils';
import { ConfigureIframeModal } from './configure_iframe_modal';
import { buildNativeEmbedMarkup } from './utils/native_embed_markup.utils';

interface Selection {
	start: EditorPosition
	end: EditorPosition
	text: string;
}

export default class AutoEmbedPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {

		await this.loadSettings();

		const embedManager = EmbedManager.Instance;
		embedManager.init(this);

		this.addSettingTab(new AutoEmbedSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on(
			"editor-menu",
			(menu: Menu, editor: Editor, _view: MarkdownView) => {
				const selection = this.getSelection(editor);
				if (!selection)
					return;

				const url = selection.text.trim();
				if (!isURL(url))
					return;

				menu.addItem((item) => {
					item
						.setTitle("Convert URL to embed")
						.setIcon("create-new")
						.onClick(() => {
							this.markToEmbed(selection, editor);
						});
				});
			}
		));

		/*
		UPDATED MESSAGE HANDLER
		Supports dynamic Mastodon instances
		*/
		this.registerDomEvent(window, "message", (e: MessageEvent) => {

			for (const source of EmbedManager.Instance.embedSources) {

				if (!source.onResizeMessage)
					continue;

				/*
				Normal embeds (Twitter, etc.)
				*/
				if (source.embedOrigin && source.embedOrigin === e.origin) {
					source.onResizeMessage(e);
					break;
				}

				/*
				Mastodon embeds (many possible origins)
				*/
				if (source.name === "Mastodon") {
					source.onResizeMessage(e);
				}
			}
		});

		this.addCommand({
			id: "create-embed",
			name: "Create embed",
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = this.getSelection(editor);
				const isValidSelection = !!selection && isURL(selection.text.trim());

				if (checking)
					return isValidSelection;

				if (!selection || !isValidSelection)
					return false;

				this.markToEmbed(selection, editor);
				return true;
			},
		});

		this.addCommand({
			id: "migrate-legacy-embeds-in-note",
			name: "Migrate legacy embeds in current note",
			editorCallback: (editor: Editor) => {
				this.migrateLegacyEmbedsInCurrentNote(editor).catch((error) => {
					if (this.settings.debug) {
						console.error("[I link therefore iframe] Failed migrating legacy embeds in current note", error);
					}
				});
				return true;
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async updateAllSavedQuizletCards(): Promise<QuizletBulkUpdateResult> {
		return await updateAllQuizletSetsFromStoredSources(
			this.app.vault,
			this.settings.quizletFolderPath,
			this.settings.saveQuizletAsSeparateNotes,
			this.settings.saveQuizletImagesToVault,
			this.settings.debug,
		);
	}

	private getSelection(editor: Editor): Selection | null {

		if (!editor.somethingSelected())
			return null;

		return {
			start: editor.getCursor("from"),
			end: editor.getCursor("to"),
			text: editor.getSelection()
		};
	}

	markToEmbed(selection: Selection, editor: Editor) {
		this.insertEmbed(selection, editor).catch((error) => {
			if (this.settings.debug) {
				console.error("[I link therefore iframe] Failed to insert embed", error);
			}
		});
	}

	private async getFallbackIframeMarkup(url: string): Promise<string> {
		return await getIframe(url);
	}

	async generateEmbedMarkup(url: string, alt: string): Promise<string> {
		const embedData = EmbedManager.getEmbedData(url, alt);
		let rawMarkup: string;

		if (embedData === null) {
			rawMarkup = await this.getFallbackIframeMarkup(url);
			return buildNativeEmbedMarkup(rawMarkup, url, this.settings.showOriginalLink);
		}

		if (embedData.embedSource === EmbedManager.Instance.defaultFallbackEmbed) {
			rawMarkup = await this.getFallbackIframeMarkup(url);
			return buildNativeEmbedMarkup(rawMarkup, url, this.settings.showOriginalLink);
		}

		const isValidated = await embedData.embedSource.validateUrl(url);
		if (!isValidated) {
			if (this.settings.debug) {
				console.warn("[I link therefore iframe] Provider validation failed, falling back to generic iframe:", url);
			}

			rawMarkup = await this.getFallbackIframeMarkup(url);
			return buildNativeEmbedMarkup(rawMarkup, url, this.settings.showOriginalLink);
		}

		const embedResult = embedData.embedSource.create(url, embedData, true);
		embedData.embedSource.applyModifications(embedResult, embedData);
		rawMarkup = embedResult.containerEl.outerHTML;

		return buildNativeEmbedMarkup(rawMarkup, url, this.settings.showOriginalLink);
	}

	private async insertEmbed(selection: Selection, editor: Editor): Promise<void> {
		const originalUrl = selection.text.trim();
		let embedUrl = originalUrl;

		if (this.settings.saveImagesToVault) {
			if (this.settings.saveSocialMediaImagesToVault) {
				const resolvedSocialImageUrls = await resolveAllSocialMediaImageUrls(
					originalUrl,
					this.settings.debug,
				);

				if (resolvedSocialImageUrls.length > 0) {
					// Save all social media attachments while preserving the embed URL in the note.
					await Promise.all(resolvedSocialImageUrls.map((imgUrl) =>
						saveImageUrlToVault(
							imgUrl,
							this.app.vault,
							this.settings.imageFolderPath,
							this.settings.debug,
						),
					));

					if (this.settings.debug) {
						console.log("[I link therefore iframe] Saved social media images and kept embed URL:", originalUrl);
					}
				} else {
					embedUrl = await saveImageUrlToVault(
						embedUrl,
						this.app.vault,
						this.settings.imageFolderPath,
						this.settings.debug,
					);
				}
			} else {
				embedUrl = await saveImageUrlToVault(
					embedUrl,
					this.app.vault,
					this.settings.imageFolderPath,
					this.settings.debug,
				);
			}
		}

		if (this.settings.saveGoogleDocsToVault) {
			await saveGoogleDocToVault(
				originalUrl,
				this.app.vault,
				this.settings.googleDocsFolderPath,
				this.settings.debug,
			);
		}

		if (this.settings.saveQuizletCardsToVault) {
			const quizletExportResult = await saveQuizletSetToVault(
				originalUrl,
				this.app.vault,
				this.settings.quizletFolderPath,
				this.settings.saveQuizletAsSeparateNotes,
				this.settings.saveQuizletImagesToVault,
				this.settings.debug,
			);

			if (this.settings.debug && quizletExportResult.status !== "not-quizlet") {
				if (quizletExportResult.status === "saved") {
					new Notice(`[I link therefore iframe] Quizlet export saved to ${quizletExportResult.filePath ?? "vault"}`);
				} else if (quizletExportResult.status === "updated") {
					new Notice(`[I link therefore iframe] Quizlet export updated: +${quizletExportResult.createdCount ?? 0}, ~${quizletExportResult.updatedCount ?? 0}, =${quizletExportResult.unchangedCount ?? 0}`);
				} else if (quizletExportResult.status === "unchanged") {
					new Notice(`[I link therefore iframe] Quizlet cards unchanged (${quizletExportResult.unchangedCount ?? quizletExportResult.cardCount ?? 0})`);
				} else if (quizletExportResult.status === "no-cards") {
					new Notice("[I link therefore iframe] Quizlet export failed: no card data found on page");
				} else if (quizletExportResult.status === "not-html") {
					new Notice("[I link therefore iframe] Quizlet export skipped: URL did not return HTML");
				} else if (quizletExportResult.status === "error") {
					new Notice("[I link therefore iframe] Quizlet export failed due to request or parsing error");
				}
			}
		}

		if (isLinkToImage(embedUrl) || !isURL(embedUrl)) {
			const imageMarkdown = `![](${embedUrl})`;

			editor.replaceRange(
				imageMarkdown,
				selection.start,
				selection.end
			);

			editor.setCursor({
				line: selection.start.line,
				ch: selection.start.ch + imageMarkdown.length,
			});
			return;
		}

		try {
			const embedMarkup = await this.generateEmbedMarkup(embedUrl, "");

			editor.setSelection(selection.start, selection.end);

			new ConfigureIframeModal(this.app, embedMarkup, editor).open();
		} catch (e) {
			new Notice("Unable to convert this URL into an embed.");
			if (this.settings.debug) {
				console.error("[I link therefore iframe] Failed to generate embed markup", e);
			}
		}
	}

	private async migrateLegacyEmbedsInCurrentNote(editor: Editor): Promise<void> {
		const lineCount = editor.lineCount();
		const legacyEmbedRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
		let migratedCount = 0;

		for (let lineIndex = lineCount - 1; lineIndex >= 0; lineIndex--) {
			const lineText = editor.getLine(lineIndex);
			const matches = Array.from(lineText.matchAll(legacyEmbedRegex));

			if (matches.length === 0)
				continue;

			for (let matchIndex = matches.length - 1; matchIndex >= 0; matchIndex--) {
				const match = matches[matchIndex];
				const fullMatch = match[0];
				const alt = (match[1] ?? "").trim();
				const url = (match[2] ?? "").trim();
				const start = match.index;

				if (start === undefined || !isURL(url) || isLinkToImage(url))
					continue;

				try {
					const embedMarkup = await this.generateEmbedMarkup(url, alt);

					editor.replaceRange(
						embedMarkup,
						{ line: lineIndex, ch: start },
						{ line: lineIndex, ch: start + fullMatch.length },
					);

					migratedCount++;
				} catch (e) {
					if (this.settings.debug) {
						console.error("[I link therefore iframe] Failed migrating legacy embed", { url, error: e });
					}
				}
			}
		}

		new Notice(`I link therefore iframe: migrated ${migratedCount} legacy embeds.`);
	}

}
