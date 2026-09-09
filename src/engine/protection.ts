import type { Span } from './types.js';
export function protectedSpans(text: string, custom: string[] = []): Span[] {
    const spans: Span[] = [];
    const add = (start: number, end: number, reason: string) => {
        if (end > start)
            spans.push({ start, end, text: text.slice(start, end), reason });
    };
    const match = (pattern: RegExp, reason: string) => {
        for (const m of text.matchAll(pattern))
            add(m.index!, m.index! + m[0].length, reason);
    };
    // Preserve entire valid JSON documents, including insignificant-looking spacing inside strings.
    try {
        if (/^[\s]*[\[{]/.test(text)) {
            JSON.parse(text);
            add(0, text.length, 'JSON document');
            return spans;
        }
    }
    catch { /* Not a complete JSON document. */ }
    match(/```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)/g, 'Code fence');
    match(/`[^`\n]*`/g, 'Inline code');
    match(/ {2,}(?=\r?\n)/g, 'Markdown hard line break');
    match(/"(?:\\.|[^"\\])*"|“[^”]*”|'[^'\n]{2,}'/g, 'Quoted string');
    match(/https?:\/\/[^\s<>]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, 'URL or email');
    match(/\b(?:not|never|no|cannot|without|unless|except|don['’]t|can['’]t|mustn['’]t|shouldn['’]t|won['’]t|isn['’]t|doesn['’]t)\b/gi, 'Negation or logical qualifier');
    match(/(?<![\w])(?:[$€£¥][+-]?|[+-][$€£¥]?)?\d+(?:[.,:/-]\d+)*(?:%|[A-Za-z]+\b)?/g, 'Number or date');
    match(/<\/?[A-Za-z][^>]*>/g, 'XML / HTML tag');
    match(/\b[a-zA-Z]+(?:_[a-zA-Z0-9]+)+\b|\$\{[^}]+\}|\{\{[^}]+\}\}|\b[A-Z]{2,}[A-Z0-9_]*\b/g, 'Identifier or acronym');
    match(/\b[a-zA-Z][\w]*(?:[-.][\w]+)+\b|\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g, 'Identifier or filename (heuristic)');
    match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, 'Possible multiword proper noun (heuristic)');
    match(/^(?:[ \t]*#{1,6}\s+.*|[ \t]*[-*+]\s+.*|[ \t]*\d+[.)]\s+.*|[ \t]*>.*|[ \t]*\|.*|[ \t]{4,}.*)$/gm, 'Meaningful Markdown / indentation');
    // Protect instruction clauses, not only the words "must" or "never".
    const instruction = /(?:^|(?<=[.!?\n]))\s*(?:(?:please|you\s+(?:must|should|will|need\s+to))\s+)?(?:do\s+not|never|must|return|respond|output|write|summarize|calculate|extract|classify|compare|explain|list|use|keep|preserve|avoid|include|exclude|ensure|answer|format|delete|generate|translate)\b[^\n.!?]*(?:[.!?]|$)/gi;
    for (const m of text.matchAll(instruction)) {
        const leading = m[0].match(/^\s*/)?.[0].length ?? 0;
        add(m.index! + leading, m.index! + m[0].length, 'Explicit instruction (heuristic)');
    }
    for (const term of new Set(custom.filter(t => t.trim()))) {
        let from = 0;
        while (from < text.length) {
            const at = text.indexOf(term, from);
            if (at < 0)
                break;
            add(at, at + term.length, 'User-protected exact text');
            from = at + 1; // Overlapping exact occurrences are independently protected.
        }
    }
    return spans.sort((a, b) => a.start - b.start || b.end - a.end);
}
export const overlaps = (start: number, end: number, spans: Span[]) => spans.some(s => start < s.end && end > s.start);
export function mergedSpans(spans: Span[]): {
    start: number;
    end: number;
}[] {
    const out: {
        start: number;
        end: number;
    }[] = [];
    for (const s of [...spans].sort((a, b) => a.start - b.start)) {
        const last = out.at(-1);
        if (last && s.start <= last.end)
            last.end = Math.max(last.end, s.end);
        else
            out.push({ start: s.start, end: s.end });
    }
    return out;
}
export function transformUnprotected(text: string, spans: Span[], transform: (segment: string) => string): string {
    let at = 0, result = '';
    for (const span of mergedSpans(spans)) {
        result += transform(text.slice(at, span.start)) + text.slice(span.start, span.end);
        at = span.end;
    }
    return result + transform(text.slice(at));
}
/** Occurrence-aware lexical retention, not a claim about the semantic relationships between spans. */
export function protectionRetention(original: string, compressed: string, custom: string[] = []) {
    const spans = protectedSpans(original, custom);
    const available = new Map<string, number>();
    const used = new Map<string, number>();
    let retained = 0;
    for (const s of spans) {
        const key = s.reason + '\0' + s.text;
        if (!available.has(key)) {
            let from = 0, count = 0;
            while (from < compressed.length) {
                const at = compressed.indexOf(s.text, from);
                if (at < 0)
                    break;
                count++;
                from = at + 1;
            }
            available.set(key, count);
        }
        const n = used.get(key) ?? 0;
        if (n < (available.get(key) ?? 0))
            retained++;
        used.set(key, n + 1);
    }
    return { total: spans.length, retained, rate: spans.length ? retained / spans.length : null };
}
