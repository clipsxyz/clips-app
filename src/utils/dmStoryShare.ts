import { parsePublicShareLink } from './publicShareLink';

export type DmStoryShare = {
    handle: string;
    storyId: string;
    /** Text left after the share link and the default “check out this story” line. */
    caption: string;
};

/** Story link plus an optional note, same shape the thread already parses. */
export function buildStoryDmText(note: string, handle: string, url: string): string {
    const bare = handle.replace(/^@/, '').trim();
    const line = `Check out this story by @${bare}\n${url}`;
    const caption = note.trim();
    return caption ? `${caption}\n${line}` : line;
}

/** Pull a Stories 24 share out of a DM body. */
export function storyShareFromMessageText(text: string | null | undefined): DmStoryShare | null {
    const raw = String(text || '');
    if (!raw) return null;
    const urls = raw.match(/https?:\/\/[^\s]+/g) || [];
    for (const url of urls) {
        const trimmed = url.replace(/[),.;]+$/g, '');
        const parsed = parsePublicShareLink(trimmed);
        if (parsed?.kind !== 'story') continue;
        const caption = raw
            .replace(url, ' ')
            .replace(/check out this story by @\S+/i, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return { handle: parsed.handle, storyId: parsed.storyId, caption };
    }
    return null;
}
