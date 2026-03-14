/**
 * Sets multiple CSS properties on an element.
 * @param el The HTMLElement to modify.
 * @param props An object mapping CSS property names to values.
 */
export function setCssProps(el: HTMLElement, props: { [key: string]: string }) {
    for (const key in props) {
        const cssKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        el.style.setProperty(cssKey, props[key]);
    }
}
export const regexUrl = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi

export function isURL(str: string) : boolean {
    let url: URL;

    try {
        url = new URL(str);
    } catch {
        return false;
    }
    
    return url.protocol === "http:" || url.protocol === "https:";
}

export function isLinkToImage(str: string) : boolean {
    const url = new URL(str);
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url.pathname);
}

export interface Dictionary<T> {
    [key: string]: T;
}

export interface Size {
    width: number;
    height: number;
}