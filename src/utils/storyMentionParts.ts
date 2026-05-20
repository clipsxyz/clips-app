export type StoryMentionPart =
    | { type: 'text'; value: string }
    | { type: 'mention'; value: string; clickable: boolean };

/** Split story overlay text into plain text and @mention segments (web StoriesPage parity). */
export function parseStoryMentionParts(
    text: string,
    taggedUsers?: string[],
): StoryMentionPart[] {
    if (!text) return [];
    const parts: StoryMentionPart[] = [];
    const mentionRegex = /@([\w@]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
        }
        const handle = match[1];
        const clickable = taggedUsers?.includes(handle) === true;
        parts.push({ type: 'mention', value: handle, clickable });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.substring(lastIndex) });
    }
    return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}
