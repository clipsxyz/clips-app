import React from 'react';

function toTwemojiHexSequenceFromCode(code: string): string | null {
    const cc = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return null;
    const base = 0x1f1e6; // Regional Indicator Symbol Letter A
    const a = cc.charCodeAt(0) - 65; // 'A'
    const b = cc.charCodeAt(1) - 65;
    if (a < 0 || a > 25 || b < 0 || b > 25) return null;
    const cp1 = base + a;
    const cp2 = base + b;
    return `${cp1.toString(16)}-${cp2.toString(16)}`;
}

function toTwemojiHexSequenceFromEmoji(flag: string): string | null {
    if (!flag) return null;
    const cps: number[] = [];
    for (const ch of Array.from(flag)) {
        const cp = ch.codePointAt(0);
        if (typeof cp === 'number') cps.push(cp);
    }
    if (cps.length < 2) return null;
    return cps.map(cp => cp.toString(16)).join('-');
}

function toTwemojiUrl(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    let seq: string | null = null;
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
        seq = toTwemojiHexSequenceFromCode(trimmed);
    } else {
        seq = toTwemojiHexSequenceFromEmoji(trimmed);
    }
    if (!seq) return null;
    // Twemoji CDN
    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${seq}.svg`;
}

export default function Flag({ value, size = 18, className = '', title }: { value?: string; size?: number; className?: string; title?: string }) {
    if (!value) return null;
    const url = toTwemojiUrl(value);
    if (!url) return <span className={className} style={{ fontSize: size }}>{value}</span>;
    return (
        <img
            src={url}
            width={size}
            height={size}
            className={className}
            alt={value}
            title={title || value}
            loading="lazy"
            decoding="async"
            style={{ display: 'inline-block' }}
        />
    );
}


