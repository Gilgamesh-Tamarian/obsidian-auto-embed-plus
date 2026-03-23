import { normalizePath, requestUrl, TFile, Vault } from "obsidian";
import { ensureFolderExists, hashString, isURL, sanitizeFileName, saveImageUrlToVault } from "src/utility";
import { parseQuizletSetId } from "src/utils/url.utils";

interface QuizletCard {
    cardId?: string;
    term: string;
    definition: string;
    imageUrl?: string;
    localImagePath?: string;
}

interface ParsedQuizletMetadata {
    setId?: string;
    cardId?: string;
}

interface ParsedQuizletCardUserNotes {
    front: string;
    back: string;
}

export interface QuizletExportResult {
    status: "not-quizlet" | "not-html" | "no-cards" | "saved" | "updated" | "unchanged" | "error";
    filePath?: string;
    cardCount?: number;
    createdCount?: number;
    updatedCount?: number;
    unchangedCount?: number;
}

export interface QuizletBulkUpdateResult {
    scannedFiles: number;
    sourceMentions: number;
    uniqueSetCount: number;
    refreshedSetCount: number;
    savedCount: number;
    updatedCount: number;
    unchangedCount: number;
    noCardsCount: number;
    notHtmlCount: number;
    errorCount: number;
}

const QUIZLET_USER_NOTES_START = "<!-- quizlet:user-notes:start -->";
const QUIZLET_USER_NOTES_END = "<!-- quizlet:user-notes:end -->";
const QUIZLET_STALE_MARKER = "<!-- quizlet:stale=true -->";
const QUIZLET_SOURCE_PREFIX = "<!-- quizlet:source=";
const QUIZLET_SET_ID_PROPERTY = "QuizletSetId";
const QUIZLET_CARD_ID_PROPERTY = "QuizletCardId";

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function yamlQuote(value: string): string {
    return JSON.stringify(value);
}

function upsertFrontmatterValue(frontmatter: string, key: string, value: string): string {
    const normalized = frontmatter.trimEnd();
    const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.*$`, "m");
    const replacement = `${key}: ${yamlQuote(value)}`;

    if (!normalized) {
        return replacement;
    }

    if (pattern.test(normalized)) {
        return normalized.replace(pattern, replacement);
    }

    return `${normalized}\n${replacement}`;
}

function withQuizletFrontmatterProperties(
    frontmatter: string,
    metadata: { setId: string; cardId?: string },
): string {
    let nextFrontmatter = upsertFrontmatterValue(frontmatter, QUIZLET_SET_ID_PROPERTY, metadata.setId);
    if (metadata.cardId) {
        nextFrontmatter = upsertFrontmatterValue(nextFrontmatter, QUIZLET_CARD_ID_PROPERTY, metadata.cardId);
    }
    return nextFrontmatter;
}

function readFrontmatterValue(frontmatter: string, key: string): string | undefined {
    const match = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+)$`, "m"));
    if (!match?.[1]) {
        return undefined;
    }

    const rawValue = match[1].trim();
    if (!rawValue) {
        return undefined;
    }

    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        try {
            return JSON.parse(rawValue.replace(/^'/, '"').replace(/'$/, '"'));
        } catch {
            return rawValue.slice(1, -1);
        }
    }

    return rawValue;
}

function buildQuizletSingleFileContent(
    title: string,
    cards: QuizletCard[],
    setId: string,
    originalUrl: string,
    frontmatter: string = "",
    userNotes: string = "",
): string {
    const lines: string[] = [];
    const managedFrontmatter = withQuizletFrontmatterProperties(frontmatter, {
        setId,
    });

    if (managedFrontmatter.trim()) {
        lines.push("---");
        lines.push(managedFrontmatter.trimEnd());
        lines.push("---");
        lines.push("");
    }

    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`**Source:** ${originalUrl}  `);
    lines.push(`**Cards:** ${cards.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const card of cards) {
        lines.push(`**${card.term}**`);
        lines.push(card.definition);
        if (card.localImagePath) {
            lines.push("");
            lines.push(`![[${card.localImagePath}]]`);
        }
        lines.push("");
    }

    lines.push(`${QUIZLET_SOURCE_PREFIX}${originalUrl} -->`);
    lines.push(QUIZLET_USER_NOTES_START);
    if (userNotes.trim()) {
        lines.push(userNotes.trimEnd());
    }
    lines.push(QUIZLET_USER_NOTES_END);
    lines.push("");

    return lines.join("\n");
}

async function saveQuizletSetAsSingleFile(
    vault: Vault,
    folderPath: string,
    title: string,
    setId: string,
    originalUrl: string,
    cards: QuizletCard[],
): Promise<QuizletExportResult> {
    await ensureFolderExists(vault, folderPath);

    const filePath = normalizePath(`${folderPath}/${sanitizeFileName(title)}-${hashString(setId)}.md`);
    const existingFile = await findExistingQuizletSingleFile(vault, folderPath, setId) ?? vault.getAbstractFileByPath(filePath);

    if (existingFile instanceof TFile) {
        const existingContent = await vault.cachedRead(existingFile);
        const { frontmatter } = parseExistingFrontmatter(existingContent);
        const userNotes = parseQuizletUserNotes(existingContent);
        const nextContent = buildQuizletSingleFileContent(title, cards, setId, originalUrl, frontmatter, userNotes);
        if (existingContent !== nextContent) {
            await vault.modify(existingFile, nextContent);
            return {
                status: "updated",
                filePath: existingFile.path,
                cardCount: cards.length,
                createdCount: 0,
                updatedCount: 1,
                unchangedCount: 0,
            };
        }

        return {
            status: "unchanged",
            filePath: existingFile.path,
            cardCount: cards.length,
            createdCount: 0,
            updatedCount: 0,
            unchangedCount: 1,
        };
    }

    const content = buildQuizletSingleFileContent(title, cards, setId, originalUrl);
    await vault.create(filePath, content);
    return {
        status: "saved",
        filePath,
        cardCount: cards.length,
        createdCount: 1,
        updatedCount: 0,
        unchangedCount: 0,
    };
}

async function findExistingQuizletSingleFile(vault: Vault, folderPath: string, setId: string): Promise<TFile | null> {
    const normalizedFolderPath = normalizePath(folderPath);
    const candidates = vault.getMarkdownFiles().filter(file => file.parent?.path === normalizedFolderPath);

    for (const file of candidates) {
        try {
            const content = await vault.cachedRead(file);
            const metadata = parseQuizletMetadata(content);
            if (metadata.setId === setId && !metadata.cardId) {
                return file;
            }
        } catch {
            // Ignore unreadable files while looking for an existing single-file export.
        }
    }

    return null;
}

function stripHtmlTags(text: string): string {
    return text
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeQuizletText(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }

    return stripHtmlTags(
        value
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim(),
    );
}

function pushQuizletCard(cards: QuizletCard[], termValue: unknown, definitionValue: unknown) {
    const term = normalizeQuizletText(termValue);
    const definition = normalizeQuizletText(definitionValue);

    if (!term || !definition) {
        return;
    }

    cards.push({ term, definition });
}

function collectQuizletCards(value: unknown, cards: QuizletCard[]): void {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectQuizletCards(item, cards);
        }
        return;
    }

    if (typeof value !== "object") {
        return;
    }

    const obj = value as Record<string, unknown>;

    pushQuizletCard(cards, obj.term, obj.definition);
    pushQuizletCard(cards, obj.word, obj.definition);

    const questionText =
        (obj.text as string | undefined) ||
        (obj.name as string | undefined) ||
        (obj.question as string | undefined);

    let answerText: unknown = undefined;
    if (typeof obj.acceptedAnswer === "object" && obj.acceptedAnswer) {
        answerText = (obj.acceptedAnswer as Record<string, unknown>).text;
    }
    if (!answerText && typeof obj.suggestedAnswer === "object" && obj.suggestedAnswer) {
        answerText = (obj.suggestedAnswer as Record<string, unknown>).text;
    }
    if (!answerText && typeof obj.answer === "object" && obj.answer) {
        answerText = (obj.answer as Record<string, unknown>).text;
    }
    if (!answerText) {
        answerText = obj.description;
    }

    pushQuizletCard(cards, questionText, answerText);

    for (const nestedValue of Object.values(obj)) {
        collectQuizletCards(nestedValue, cards);
    }
}

function dedupeQuizletCards(cards: QuizletCard[]): QuizletCard[] {
    const deduped = new Map<string, QuizletCard>();
    for (const card of cards) {
        const key = `${card.term}\n${card.definition}`.toLowerCase();
        if (!deduped.has(key)) {
            deduped.set(key, card);
        }
    }
    return Array.from(deduped.values());
}

function parseQuizletCardsFromHtml(html: string): QuizletCard[] {
    const cards: QuizletCard[] = [];
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html)) !== null) {
        const raw = (match[1] || "").trim();
        if (!raw) {
            continue;
        }

        try {
            const parsed = JSON.parse(raw);
            collectQuizletCards(parsed, cards);
        } catch {
            // Ignore malformed json-ld blocks.
        }
    }

    return dedupeQuizletCards(cards);
}

function parseJsonEscapedString(value: string): string {
    try {
        return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"')}"`);
    } catch {
        return value;
    }
}

function parseQuizletCardsFromScripts(html: string): QuizletCard[] {
    const cards: QuizletCard[] = [];
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];

    const pairPatterns = [
        /"term"\s*:\s*"((?:\\.|[^"\\])+)"[\s\S]{0,1000}?"definition"\s*:\s*"((?:\\.|[^"\\])+)"/g,
        /"word"\s*:\s*"((?:\\.|[^"\\])+)"[\s\S]{0,1000}?"definition"\s*:\s*"((?:\\.|[^"\\])+)"/g,
        /"word"\s*:\s*\{[\s\S]{0,80}?"text"\s*:\s*"((?:\\.|[^"\\])+)"[\s\S]{0,500}?"definition"\s*:\s*\{[\s\S]{0,80}?"text"\s*:\s*"((?:\\.|[^"\\])+)"/g,
    ];

    for (const scriptTag of scripts) {
        for (const pattern of pairPatterns) {
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(scriptTag)) !== null) {
                const term = normalizeQuizletText(parseJsonEscapedString(match[1] || ""));
                const definition = normalizeQuizletText(parseJsonEscapedString(match[2] || ""));
                if (term && definition) {
                    cards.push({ term, definition });
                }
            }
        }
    }

    return dedupeQuizletCards(cards);
}

function mapQuizletStudiableItems(items: unknown[]): QuizletCard[] {
    const cards: QuizletCard[] = [];
    for (const item of items) {
        if (typeof item !== "object" || !item) continue;
        const obj = item as Record<string, unknown>;
        if (!Array.isArray(obj.cardSides)) continue;

        let term = "";
        let definition = "";
        let imageUrl: string | undefined = undefined;
        for (const side of obj.cardSides as unknown[]) {
            if (typeof side !== "object" || !side) continue;
            const s = side as Record<string, unknown>;
            if (!Array.isArray(s.media)) continue;
            for (const med of s.media as unknown[]) {
                if (typeof med !== "object" || !med) continue;
                const m = med as Record<string, unknown>;
                if (!imageUrl && (m.type === 2 || m.type === 5) && typeof m.url === "string" && m.url) {
                    imageUrl = m.url;
                }
                if (m.type !== 1) continue;
                const text = normalizeQuizletText(m.plainText ?? "");
                if (s.label === "word" && text) term = text;
                else if (s.label === "definition" && text) definition = text;
            }
        }
        const rawCardId = typeof obj.id === "number" || typeof obj.id === "string"
            ? String(obj.id)
            : undefined;
        if (term && definition) cards.push({ cardId: rawCardId, term, definition, imageUrl });
    }

    return dedupeQuizletCards(cards);
}

function extractStudiableItems(obj: unknown, depth = 0): unknown[] | null {
    if (depth > 12 || !obj || typeof obj !== "object") return null;

    if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
            const first = obj[0] as Record<string, unknown>;
            if (Array.isArray(first.cardSides)) return obj;
        }
        for (const item of obj) {
            const found = extractStudiableItems(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    const record = obj as Record<string, unknown>;
    for (const key of ["studiableItems", "studiableItem"]) {
        const val = record[key];
        if (Array.isArray(val) && val.length > 0) return val as unknown[];
    }
    for (const val of Object.values(record)) {
        const found = extractStudiableItems(val, depth + 1);
        if (found) return found;
    }
    return null;
}

function parseQuizletCardsFromNextData(html: string): QuizletCard[] {
    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!nextDataMatch?.[1]) return [];

    let data: unknown;
    try {
        data = JSON.parse(nextDataMatch[1].trim());
    } catch {
        return [];
    }

    const tryDehydrated = (obj: unknown, d = 0): unknown[] | null => {
        if (d > 8 || typeof obj !== "object" || !obj) return null;
        const record = obj as Record<string, unknown>;
        if (typeof record.dehydratedReduxStateKey === "string") {
            try {
                const inner: unknown = JSON.parse(JSON.parse(record.dehydratedReduxStateKey as string));
                const items = extractStudiableItems(inner);
                if (items && items.length > 0) return items;
            } catch { /* continue */ }
        }
        for (const val of Object.values(record)) {
            const found = tryDehydrated(val, d + 1);
            if (found) return found;
        }
        return null;
    };

    const dehydratedItems = tryDehydrated(data);
    if (dehydratedItems && dehydratedItems.length > 0) {
        const mapped = mapQuizletStudiableItems(dehydratedItems);
        if (mapped.length > 0) return mapped;
    }

    const directItems = extractStudiableItems(data);
    if (directItems && directItems.length > 0) {
        const mapped = mapQuizletStudiableItems(directItems);
        if (mapped.length > 0) return mapped;
    }

    const cards: QuizletCard[] = [];
    collectQuizletCards(data, cards);
    return dedupeQuizletCards(cards);
}

function parseQuizletCardsFromQuizletVars(html: string): QuizletCard[] {
    const patterns = [
        /window\.Quizlet\["setPageData"\]\s*=\s*([\s\S]+?);\s*QLoad\("Quizlet\.setPageData"\)/,
        /window\.Quizlet\["cardsModeData"\]\s*=\s*([\s\S]+?);\s*QLoad\("Quizlet\.cardsModeData"\)/,
        /window\.Quizlet\["assistantModeData"\]\s*=\s*([\s\S]+?);\s*QLoad\("Quizlet\.assistantModeData"\)/,
    ];

    for (const pattern of patterns) {
        const m = html.match(pattern);
        if (!m?.[1]) continue;
        try {
            const data: unknown = JSON.parse(m[1].trim());
            const items = extractStudiableItems(data);
            if (items && items.length > 0) {
                const mapped = mapQuizletStudiableItems(items);
                if (mapped.length > 0) return mapped;
            }
            const fallbackCards: QuizletCard[] = [];
            collectQuizletCards(data, fallbackCards);
            if (fallbackCards.length > 0) {
                return dedupeQuizletCards(fallbackCards);
            }
        } catch { /* Try next pattern */ }
    }
    return [];
}

async function tryQuizletRestApi(setId: string, fetchHeaders: Record<string, string>): Promise<QuizletCard[]> {
    const apiUrl =
        `https://quizlet.com/webapi/3.9/studiable-item-documents` +
        `?filters%5BstudiableContainerId%5D=${setId}` +
        `&filters%5BstudiableContainerType%5D=1&perPage=1000&page=1`;
    try {
        const resp = await requestUrl({
            url: apiUrl,
            method: "GET",
            headers: { ...fetchHeaders, "Accept": "application/json" },
        });
        const ct = resp.headers["content-type"] ?? "";
        if (!ct.includes("json")) return [];
        const data: unknown = resp.json ?? JSON.parse(resp.text);
        const items = extractStudiableItems(data);
        if (items && items.length > 0) {
            const mapped = mapQuizletStudiableItems(items);
            if (mapped.length > 0) return mapped;
        }
        const fallbackCards: QuizletCard[] = [];
        collectQuizletCards(data, fallbackCards);
        return dedupeQuizletCards(fallbackCards);
    } catch {
        return [];
    }
}

async function tryQuizletSetTitleApi(setId: string, fetchHeaders: Record<string, string>): Promise<string | null> {
    const apiUrl = `https://quizlet.com/webapi/3.9/sets/${setId}`;
    try {
        const resp = await requestUrl({
            url: apiUrl,
            method: "GET",
            headers: { ...fetchHeaders, "Accept": "application/json" },
        });
        const ct = resp.headers["content-type"] ?? "";
        if (!ct.includes("json")) return null;
        const data = (resp.json ?? JSON.parse(resp.text)) as {
            responses?: Array<{ models?: { set?: Array<{ title?: unknown }> } }>;
        };
        const title = data.responses?.[0]?.models?.set?.[0]?.title;
        return typeof title === "string" && title.trim() ? title.trim() : null;
    } catch {
        return null;
    }
}

function parseQuizletCardsFromVisibleText(html: string): QuizletCard[] {
    const text = normalizeQuizletText(html.replace(/<[^>]+>/g, "\n"));
    const markerMatch = text.match(/Terms in this set\s*\(\d+\)([\s\S]{0,40000})/i);
    if (!markerMatch || !markerMatch[1]) {
        return [];
    }

    const section = markerMatch[1]
        .split(/Additional Links|Created by|Students also studied/i)[0]
        .trim();

    const tokens = section
        .split(/\s{2,}|\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4000);

    const cards: QuizletCard[] = [];
    for (let i = 0; i + 1 < tokens.length; i += 2) {
        const term = normalizeQuizletText(tokens[i]);
        const definition = normalizeQuizletText(tokens[i + 1]);

        if (!term || !definition) {
            continue;
        }

        if (term.length > 200 || definition.length > 600) {
            continue;
        }

        cards.push({ term, definition });
    }

    return dedupeQuizletCards(cards);
}

function quizletTitleFromHtml(html: string, fallback: string): string {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (!titleMatch || !titleMatch[1]) {
        return fallback;
    }

    const cleaned = normalizeQuizletText(titleMatch[1].replace(/\s*\|\s*Quizlet\s*$/i, ""));
    return cleaned || fallback;
}

function slugifyForFileName(value: string, fallback: string): string {
    const slug = sanitizeFileName(value)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/_+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
    return slug || fallback;
}

function parseExistingFrontmatter(content: string): { frontmatter: string; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) {
        return { frontmatter: "", body: content };
    }

    return {
        frontmatter: match[1] ?? "",
        body: content.slice(match[0].length),
    };
}

function parseQuizletUserNotes(content: string): string {
    const explicitMatch = content.match(
        /<!--\s*quizlet:user-notes:start\s*-->\r?\n?([\s\S]*?)\r?\n?<!--\s*quizlet:user-notes:end\s*-->/i,
    );
    if (explicitMatch && explicitMatch[1] !== undefined) {
        return explicitMatch[1].trimEnd();
    }

    const legacyMatch = content.match(/<!--\s*quizlet:source=.*?-->\s*([\s\S]*)$/i);
    if (!legacyMatch || !legacyMatch[1]) {
        return "";
    }

    return legacyMatch[1].replace(new RegExp(`\n?${escapeRegExp(QUIZLET_STALE_MARKER)}\s*$`), "").trimEnd();
}

function parseQuizletCardUserNotes(content: string): ParsedQuizletCardUserNotes {
    const explicitMatches = Array.from(content.matchAll(
        /<!--\s*quizlet:user-notes:start\s*-->\r?\n?([\s\S]*?)\r?\n?<!--\s*quizlet:user-notes:end\s*-->/gi,
    ));

    if (explicitMatches.length >= 2) {
        return {
            front: (explicitMatches[0]?.[1] ?? "").trimEnd(),
            back: (explicitMatches[1]?.[1] ?? "").trimEnd(),
        };
    }

    if (explicitMatches.length === 1) {
        return {
            front: "",
            back: (explicitMatches[0]?.[1] ?? "").trimEnd(),
        };
    }

    return {
        front: "",
        back: parseQuizletUserNotes(content),
    };
}

function parseQuizletMetadata(content: string): ParsedQuizletMetadata {
    const { frontmatter } = parseExistingFrontmatter(content);
    return {
        setId: readFrontmatterValue(frontmatter, QUIZLET_SET_ID_PROPERTY),
        cardId: readFrontmatterValue(frontmatter, QUIZLET_CARD_ID_PROPERTY),
    };
}

async function findExistingQuizletSetFolder(vault: Vault, folderPath: string, setId: string): Promise<string | null> {
    const normalizedFolderPath = normalizePath(folderPath);
    const candidates = vault.getMarkdownFiles().filter(file => file.path.startsWith(`${normalizedFolderPath}/`));

    for (const file of candidates) {
        try {
            const content = await vault.cachedRead(file);
            const metadata = parseQuizletMetadata(content);
            if (metadata.setId === setId && metadata.cardId) {
                return file.parent?.path ?? null;
            }
        } catch {
            // Ignore unreadable files while looking for an existing set folder.
        }
    }

    return null;
}

function buildQuizletCardFileName(card: QuizletCard, index: number, effectiveCardId: string): string {
    const prefix = String(index + 1).padStart(3, "0");
    const slug = slugifyForFileName(card.term, `card-${prefix}`);
    const idSuffix = slugifyForFileName(effectiveCardId, hashString(effectiveCardId)).slice(-12);
    return `${prefix}-${slug}-${idSuffix}.md`;
}

function buildQuizletCardNoteContent(
    card: QuizletCard,
    setId: string,
    originalUrl: string,
    frontmatter: string = "",
    userNotes: ParsedQuizletCardUserNotes = { front: "", back: "" },
): string {
    const sections: string[] = [];
    const managedFrontmatter = withQuizletFrontmatterProperties(frontmatter, {
        setId,
        cardId: card.cardId ?? hashString(`${card.term}\n${card.definition}`),
    });

    if (managedFrontmatter.trim()) {
        sections.push("---");
        sections.push(managedFrontmatter.trimEnd());
        sections.push("---");
        sections.push("");
    }

    sections.push(card.term.trim());
    sections.push("");
    sections.push(QUIZLET_USER_NOTES_START);
    if (userNotes.front.trim()) {
        sections.push(userNotes.front.trimEnd());
    }
    sections.push(QUIZLET_USER_NOTES_END);
    sections.push("");
    sections.push("---");
    sections.push("");
    sections.push(card.definition.trim());
    if (card.localImagePath) {
        sections.push("");
        sections.push(`![[${card.localImagePath}]]`);
    }
    sections.push("");
    sections.push(QUIZLET_USER_NOTES_START);
    if (userNotes.back.trim()) {
        sections.push(userNotes.back.trimEnd());
    }
    sections.push(QUIZLET_USER_NOTES_END);
    sections.push("");
    sections.push(`${QUIZLET_SOURCE_PREFIX}${originalUrl} -->`);
    sections.push("");

    return sections.join("\n");
}

async function localizeQuizletCardImages(
    cards: QuizletCard[],
    vault: Vault,
    assetFolderPath: string,
    debug: boolean,
): Promise<QuizletCard[]> {
    const localizedCards: QuizletCard[] = [];

    for (const card of cards) {
        if (!card.imageUrl) {
            localizedCards.push(card);
            continue;
        }

        const savedImagePath = await saveImageUrlToVault(card.imageUrl, vault, assetFolderPath, debug);
        localizedCards.push({
            ...card,
            localImagePath: isURL(savedImagePath) ? undefined : normalizePath(savedImagePath),
        });
    }

    return localizedCards;
}

export async function saveQuizletSetToVault(
    url: string,
    vault: Vault,
    folderPath: string,
    saveAsSeparateNotes: boolean = false,
    saveImagesToVault: boolean = true,
    debug: boolean = false,
): Promise<QuizletExportResult> {
    const setId = parseQuizletSetId(url);
    if (!setId) {
        return { status: "not-quizlet" };
    }

    const fetchHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    };

    try {
        let cards = await tryQuizletRestApi(setId, fetchHeaders);
        if (debug && cards.length > 0) {
            console.log(`[I link therefore iframe] Quizlet REST API returned ${cards.length} cards for set:`, setId);
        }

        let html: string | null = null;
        if (cards.length === 0) {
            const flashcardsUrl = `https://quizlet.com/${setId}/flashcards`;
            const embedUrl = `https://quizlet.com/${setId}/flashcards/embed`;
            for (const fetchUrl of [url, flashcardsUrl, embedUrl]) {
                try {
                    const resp = await requestUrl({ url: fetchUrl, method: "GET", headers: fetchHeaders });
                    if (resp.headers["content-type"]?.includes("text/html") && resp.text) {
                        html = resp.text;
                        break;
                    }
                } catch { /* Try next URL */ }
            }

            if (html) {
                cards = parseQuizletCardsFromNextData(html);
                if (cards.length === 0) cards = parseQuizletCardsFromQuizletVars(html);
                if (cards.length === 0) cards = parseQuizletCardsFromHtml(html);
                if (cards.length === 0) cards = parseQuizletCardsFromScripts(html);
                if (cards.length === 0) cards = parseQuizletCardsFromVisibleText(html);
            }
        }

        if (cards.length === 0) {
            if (debug) {
                console.log("[I link therefore iframe] Could not find exportable Quizlet cards with any method for set:", setId);
            }
            return { status: html ? "no-cards" : "not-html" };
        }

        const title =
            (html ? quizletTitleFromHtml(html, "") : "") ||
            (await tryQuizletSetTitleApi(setId, fetchHeaders)) ||
            `quizlet-${setId}`;

        if (!saveAsSeparateNotes) {
            const assetFolderPath = normalizePath(`${folderPath}/quizlet-${hashString(setId)}-assets`);
            const cardsWithImages = saveImagesToVault
                ? await localizeQuizletCardImages(cards, vault, assetFolderPath, debug)
                : cards;
            const singleFileResult = await saveQuizletSetAsSingleFile(
                vault,
                folderPath,
                title,
                setId,
                url,
                cardsWithImages,
            );

            if (debug) {
                console.log("[I link therefore iframe] Quizlet single-file export completed:", {
                    setId,
                    filePath: singleFileResult.filePath,
                    status: singleFileResult.status,
                    cardCount: cards.length,
                });
            }

            return singleFileResult;
        }

        const existingSetFolderPath = await findExistingQuizletSetFolder(vault, folderPath, setId);
        const setFolderName = `${sanitizeFileName(title)}-${hashString(setId)}`;
        const setFolderPath = existingSetFolderPath ?? normalizePath(`${folderPath}/${setFolderName}`);

        await ensureFolderExists(vault, setFolderPath);
        const cardsWithImages = saveImagesToVault
            ? await localizeQuizletCardImages(cards, vault, setFolderPath, debug)
            : cards;

        const existingManagedFiles = vault
            .getMarkdownFiles()
            .filter((file) => file.path.startsWith(`${setFolderPath}/`));

        const filesByCardId = new Map<string, TFile>();
        for (const file of existingManagedFiles) {
            try {
                const content = await vault.cachedRead(file);
                const metadata = parseQuizletMetadata(content);
                if (metadata.setId === setId && metadata.cardId) {
                    filesByCardId.set(metadata.cardId, file);
                }
            } catch {
                // Ignore unreadable files in the target folder.
            }
        }

        let createdCount = 0;
        let updatedCount = 0;
        let unchangedCount = 0;
        const currentCardIds = new Set<string>();

        for (const [index, rawCard] of cardsWithImages.entries()) {
            const effectiveCardId = rawCard.cardId ?? hashString(`${rawCard.term}\n${rawCard.definition}`);
            currentCardIds.add(effectiveCardId);
            const card: QuizletCard = { ...rawCard, cardId: effectiveCardId };
            const existingFile = filesByCardId.get(effectiveCardId);

            if (existingFile) {
                const existingContent = await vault.cachedRead(existingFile);
                const { frontmatter } = parseExistingFrontmatter(existingContent);
                const userNotes = parseQuizletCardUserNotes(existingContent);
                const nextContent = buildQuizletCardNoteContent(card, setId, url, frontmatter, userNotes);
                if (existingContent !== nextContent) {
                    await vault.modify(existingFile, nextContent);
                    updatedCount++;
                } else {
                    unchangedCount++;
                }
                continue;
            }

            const fileName = buildQuizletCardFileName(card, index, effectiveCardId);
            const filePath = normalizePath(`${setFolderPath}/${fileName}`);
            const content = buildQuizletCardNoteContent(card, setId, url);
            await vault.create(filePath, content);
            createdCount++;
        }

        for (const [cardId, file] of filesByCardId.entries()) {
            if (currentCardIds.has(cardId)) {
                continue;
            }

            const existingContent = await vault.cachedRead(file);
            if (!existingContent.includes(QUIZLET_STALE_MARKER)) {
                await vault.modify(file, `${existingContent.trimEnd()}\n${QUIZLET_STALE_MARKER}\n`);
                updatedCount++;
            }
        }

        if (debug) {
            console.log("[I link therefore iframe] Quizlet card export completed:", {
                setId,
                setFolderPath,
                createdCount,
                updatedCount,
                unchangedCount,
                cardCount: cardsWithImages.length,
            });
        }

        if (createdCount > 0) {
            return {
                status: updatedCount > 0 ? "updated" : "saved",
                filePath: setFolderPath,
                cardCount: cardsWithImages.length,
                createdCount,
                updatedCount,
                unchangedCount,
            };
        }

        if (updatedCount > 0) {
            return {
                status: "updated",
                filePath: setFolderPath,
                cardCount: cardsWithImages.length,
                createdCount,
                updatedCount,
                unchangedCount,
            };
        }

        return {
            status: "unchanged",
            filePath: setFolderPath,
            cardCount: cardsWithImages.length,
            createdCount,
            updatedCount,
            unchangedCount,
        };
    } catch (error) {
        if (debug) {
            console.error("[I link therefore iframe] Failed to save Quizlet card export:", error);
        }
        return { status: "error" };
    }
}

function parseQuizletSourceUrl(content: string): string | null {
    const match = content.match(/<!--\s*quizlet:source=(.*?)\s*-->/i);
    if (!match?.[1]) {
        return null;
    }

    const sourceUrl = match[1].trim();
    return sourceUrl || null;
}

export async function updateAllQuizletSetsFromStoredSources(
    vault: Vault,
    folderPath: string,
    saveAsSeparateNotes: boolean,
    saveImagesToVault: boolean,
    debug: boolean = false,
): Promise<QuizletBulkUpdateResult> {
    const files = vault.getMarkdownFiles();
    const uniqueSetSources = new Map<string, string>();
    let sourceMentions = 0;

    for (const file of files) {
        let content = "";
        try {
            content = await vault.cachedRead(file);
        } catch {
            continue;
        }

        const sourceUrl = parseQuizletSourceUrl(content);
        if (!sourceUrl) {
            continue;
        }

        sourceMentions++;
        const setId = parseQuizletSetId(sourceUrl);
        if (!setId) {
            continue;
        }

        if (!uniqueSetSources.has(setId)) {
            uniqueSetSources.set(setId, sourceUrl);
        }
    }

    const result: QuizletBulkUpdateResult = {
        scannedFiles: files.length,
        sourceMentions,
        uniqueSetCount: uniqueSetSources.size,
        refreshedSetCount: 0,
        savedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        noCardsCount: 0,
        notHtmlCount: 0,
        errorCount: 0,
    };

    for (const sourceUrl of uniqueSetSources.values()) {
        const exportResult = await saveQuizletSetToVault(
            sourceUrl,
            vault,
            folderPath,
            saveAsSeparateNotes,
            saveImagesToVault,
            debug,
        );

        result.refreshedSetCount++;

        if (exportResult.status === "saved") {
            result.savedCount++;
        } else if (exportResult.status === "updated") {
            result.updatedCount++;
        } else if (exportResult.status === "unchanged") {
            result.unchangedCount++;
        } else if (exportResult.status === "no-cards") {
            result.noCardsCount++;
        } else if (exportResult.status === "not-html") {
            result.notHtmlCount++;
        } else if (exportResult.status === "error" || exportResult.status === "not-quizlet") {
            result.errorCount++;
        }
    }

    return result;
}