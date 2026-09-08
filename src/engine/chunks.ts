import type { Chunk, Span } from './types.js';
export function splitChunks(text: string, protectedContent: Span[] = []): Chunk[] {
    if (!text)
        return [];
    // Retain exact original slices. Do not trim or rebuild protected code / structured data.
    const cuts = new Set<number>([0, text.length]);
    for (const m of text.matchAll(/[.!?](?:[ \t]+|(?=\n))|\n+/g)) {
        const cut = m.index! + m[0].length;
        if (!protectedContent.some(s => s.start < cut && s.end > cut))
            cuts.add(cut);
    }
    const points = [...cuts].sort((a, b) => a - b);
    return points.slice(0, -1).map((start, index) => {
        const end = points[index + 1];
        const reasons = [...new Set(protectedContent.filter(s => s.start < end && s.end > start).map(s => s.reason))];
        return { index, start, end, text: text.slice(start, end), reasons };
    });
}
export function assemble(chunks: Chunk[], retained: Set<number>): string {
    return chunks.filter(c => retained.has(c.index)).map(c => c.text).join('');
}
