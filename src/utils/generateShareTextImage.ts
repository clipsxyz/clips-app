import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';

/** Web canvas fallback when sharing a text post without media to Stories. */
export async function generateShareTextImage(text: string): Promise<string> {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1, '#f43f5e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const margin = 96;
    const maxWidth = width - margin * 2;
    let fontSize = 64;
    ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    function wrapLines(t: string): string[] {
        const words = t.split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            const metrics = ctx!.measureText(test);
            if (metrics.width > maxWidth) {
                if (line) lines.push(line);
                line = w;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    const safeText = (text || 'Shared from the feed').slice(0, TEXT_POST_BODY_MAX_LENGTH);
    let lines = wrapLines(safeText);
    while (lines.length > 10 && fontSize > 36) {
        fontSize -= 6;
        ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        lines = wrapLines(safeText);
    }

    const lineHeight = fontSize * 1.35;
    const totalHeight = lines.length * lineHeight;
    let y = height / 2 - totalHeight / 2;
    for (const ln of lines) {
        ctx.fillText(ln, width / 2, y);
        y += lineHeight;
    }

    return canvas.toDataURL('image/png');
}
