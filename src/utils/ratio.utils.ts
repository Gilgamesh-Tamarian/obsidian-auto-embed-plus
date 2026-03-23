import { AspectRatioType } from "src/types/aspect-ratio";

const DEFAULT_ASPECT_RATIO = "16/9";

function isPositiveNumber(value: string): boolean {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
}

export function isValidAspectRatio(value: string): value is `${number}/${number}` {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (!match)
        return false;

    return isPositiveNumber(match[1]) && isPositiveNumber(match[2]);
}

export function normalizeAspectRatio(value: string): `${number}/${number}` | null {
    if (!isValidAspectRatio(value))
        return null;

    const parts = value.trim().split("/");
    return `${parts[0].trim()}/${parts[1].trim()}` as `${number}/${number}`;
}

export const swapRatio = (ratio: AspectRatioType) => {
    if (ratio === "none") {
        return ratio;
    }

    if (ratio === "auto") {
        ratio = DEFAULT_ASPECT_RATIO as `${number}/${number}`;
    }

    const [a, b] = ratio.split("/");
    return `${b}/${a}`;
};
