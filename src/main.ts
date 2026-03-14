import { Editor, EditorPosition, MarkdownFileInfo, MarkdownView, Plugin } from 'obsidian';
import { AutoEmbedSettingTab, DEFAULT_SETTINGS, PluginSettings } from 'src/settings-tab';
import SuggestEmbed from 'src/suggestEmbed';
import { isLinkToImage, isURL, regexUrl } from 'src/utility';
import { embedField } from './embed-state-field';
import { EmbedManager } from './embeds/embedManager';

class PasteInfo {
	trigger: boolean;
	text: string;

	constructor(trigger: boolean, text: string) {
		this.trigger = trigger;
		this.text = text;
	}
}

interface Selection {
	start: EditorPosition
	end: EditorPosition
	text: string;
}

export default class AutoEmbedPlugin extends Plugin {
	settings: PluginSettings;
	isShiftDown = false;
	pasteInfo: PasteInfo = new PasteInfo(false, "");

	async onload() {

		await this.loadSettings();

		const embedManager = EmbedManager.Instance;
		embedManager.init(this);

		this.registerEditorExtension(embedField);

		this.addSettingTab(new AutoEmbedSettingTab(this.app, this));

		this.registerDomEvent(document, "keydown", (e) => {
			if (e.shiftKey)
				this.isShiftDown = true;
		});

		this.registerDomEvent(document, "keydown", (e) => {
			if (!e.shiftKey)
				this.isShiftDown = false;
		});

		if (this.settings.suggestEmbed)
			this.registerSuggest();

		this.registerEvent(
			this.app.workspace.on("editor-paste", this.onPaste.bind(this))
		);

		this.registerMarkdownPostProcessor((el) => {

			const images = el.querySelectorAll('img');

			images.forEach((image) => {

				if (
					image.referrerPolicy !== "no-referrer" ||
					!isURL(image.src) ||
					isLinkToImage(image.src)
				)
					return;

				this.handleImage(image);

			});
		});

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
			id: "auto-embed-add-embed",
			name: "Add embed",
			editorCallback: (editor: Editor) => {

				const cursorPos = editor.getCursor();

				editor.replaceRange("![]()", cursorPos, cursorPos);

				cursorPos.ch += 4;

				editor.setCursor(cursorPos);

				return true;
			},
		});

		this.addCommand({
			id: "auto-embed-mark-to-embed",
			name: "Mark to embed",
			editorCheckCallback: (checking: boolean, editor: Editor) => {

				const selection = this.getLinkSelection(editor);

				if (checking)
					return selection !== null;

				if (selection) {

					editor.replaceRange(
						`![](${selection.text})`,
						selection.start,
						selection.end
					);

					const newCursorPos = selection.end;

					newCursorPos.ch += 4;

					editor.setCursor(newCursorPos);

				}

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

	private onPaste(e: ClipboardEvent, editor: Editor) {

		if (e.defaultPrevented)
			return;

		if (this.isShiftDown)
			return;

		const clipboardData = e.clipboardData?.getData("text/plain");

		if (!clipboardData || !isURL(clipboardData))
			return;

		this.pasteInfo.trigger = true;
		this.pasteInfo.text = clipboardData;
	}

	handleImage(img: HTMLImageElement): HTMLElement | null {

		const alt = img.alt;

		const noEmbedRegex = /noembed/i;

		if (noEmbedRegex.test(alt)) {
			img.alt = alt.replace(noEmbedRegex, "");
			return null;
		}

		const src = img.src;

		const embedData = EmbedManager.getEmbedData(src, alt);

		if (embedData === null)
			return null;

		const embedResult = embedData.embedSource.create(src, embedData);

		embedData.embedSource.applyModifications(embedResult, embedData);

		const parent = img.parentElement;

		parent?.appendChild(embedResult.containerEl);

		img.classList.add("auto-embed-hide-display");

		img.addEventListener("load", () => {

			img.classList.remove("auto-embed-hide-display");

			embedResult.containerEl.classList.add("auto-embed-hide-display");

		});

		return embedResult.containerEl;
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

	getLinkSelection(editor: Editor): Selection | null {

		const cursor = editor.getCursor();

		const lineText = editor.getLine(cursor.line);

		const matchedLinks = lineText.matchAll(regexUrl);

		for (const match of matchedLinks) {

			if (
				match.index &&
				match.index <= cursor.ch &&
				match.index + match[0].length >= cursor.ch
			) {

				return {
					start: {
						line: cursor.line,
						ch: match.index
					},
					end: {
						line: cursor.line,
						ch: match.index + match[0].length
					},
					text: match[0]
				};
			}
		}

		return null;
	}

	markToEmbed(selection: Selection, editor: Editor) {

		editor.replaceRange(
			`![](${selection.text})`,
			selection.start,
			selection.end
		);
	}

	registerSuggest() {
		this.registerEditorSuggest(new SuggestEmbed(this));
	}
}
