import type { Chunk, Span } from './types.js';
export function splitChunks(text: string, protectedContent: Span[] = []): Chunk[] {
    if (!text)
        return [];
    // Retain exact original slices. Do not trim or rebuild protected code / structured data.
    const cuts = new Set<number>([0, text.length]);
    const spans = [...protectedContent].sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const span of spans) {
        const last = merged.at(-1);
        if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
        else merged.push({ start: span.start, end: span.end });
    }
    let boundarySpan = 0;
    for (const m of text.matchAll(/[.!?](?:[ \t]+|(?=\n))|\n+/g)) {
        const cut = m.index! + m[0].length;
        while (boundarySpan < merged.length && merged[boundarySpan].end <= cut) boundarySpan++;
        if (!merged[boundarySpan] || merged[boundarySpan].start >= cut)
            cuts.add(cut);
    }
    const points = [...cuts].sort((a, b) => a - b);
    let reasonSpan = 0;
    return points.slice(0, -1).map((start, index) => {
        const end = points[index + 1];
        const found = new Set<string>();
        // No admitted interior boundary crosses a span, so each reason span is visited once.
        while (reasonSpan < spans.length && spans[reasonSpan].start < end) {
            const span = spans[reasonSpan++];
            if (span.end > start) found.add(span.reason);
        }
        const reasons = [...found];
        return { index, start, end, text: text.slice(start, end), reasons, hardProtected: reasons.length > 0, hardProtectionReasons: reasons };
    });
}
export function assemble(chunks: Chunk[], retained: Set<number>): string {
    return chunks.filter(c => retained.has(c.index)).map(c => c.text).join('');
}
