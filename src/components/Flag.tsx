import React from 'react';
import { resolveCountryFlagDisplay } from '../utils/countryFlag';

function toTwemojiHexSequenceFromCode(code: string): string | null {
    const cc = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return null;
    const base = 0x1f1e6;
    const a = cc.charCodeAt(0) - 65;
    const b = cc.charCodeAt(1) - 65;
    if (a < 0 || a > 25 || b < 0 || b > 25) return null;
    return `${(base + a).toString(16)}-${(base + b).toString(16)}`;
}

function toTwemojiHexSequenceFromEmoji(flag: string): string | null {
    if (!flag) return null;
    const cps: number[] = [];
    for (const ch of Array.from(flag)) {
        const cp = ch.codePointAt(0);
        if (typeof cp === 'number') cps.push(cp);
    }
    if (cps.length < 2) return null;
    const isRegionalPair = cps.every((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
    if (!isRegionalPair) return null;
    return cps.map((cp) => cp.toString(16)).join('-');
}

function toTwemojiUrl(input: string): string | null {
    const resolved = resolveCountryFlagDisplay(input);
    if (!resolved) return null;

    const seqFromCode = /^[A-Z]{2}$/.test(resolved) ? toTwemojiHexSequenceFromCode(resolved) : null;
    const seq = seqFromCode || toTwemojiHexSequenceFromEmoji(resolved);
    if (!seq) return null;

    return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${seq}.svg`;
}

export default function Flag({
    value,
    size = 18,
    className = '',
    title,
    national,
}: {
    value?: string;
    size?: number;
    className?: string;
    title?: string;
    national?: string;
}) {
    const [imgFailed, setImgFailed] = React.useState(false);
    const resolved = resolveCountryFlagDisplay(value, national);

    React.useEffect(() => {
        setImgFailed(false);
    }, [value, national]);

    if (!resolved) return null;

    const url = toTwemojiUrl(resolved);
    if (!url || imgFailed) {
        if (/[\u{1F1E6}-\u{1F1FF}]/u.test(resolved)) {
            return (
                <span className={className} style={{ fontSize: size }} aria-hidden>
                    {resolved}
                </span>
            );
        }
        return null;
    }

    return (
        <img
            src={url}
            width={size}
            height={size}
            className={className}
            alt=""
            title={title || resolved}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            style={{ display: 'inline-block' }}
        />
    );
}
