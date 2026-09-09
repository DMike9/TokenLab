import type { Chunk, Settings, TaskCandidate, TaskFocus } from './types.js';
import { splitChunks } from './chunks.js';
import { protectedSpans } from './protection.js';

// Content/offset identity for selecting an original slice, not a security hash.
// Runs separately record SHA-256 of the selected text and the entire input.
export function chunkId(chunk: Chunk): string {
    let hash = 2166136261;
    for (let i = 0; i < chunk.text.length; i++) hash = Math.imul(hash ^ chunk.text.charCodeAt(i), 16777619);
    return `${chunk.index}:${chunk.start}:${chunk.end}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export function originalChunks(text: string, terms: string[]): Chunk[] {
    return splitChunks(text, protectedSpans(text, terms));
}
export const imperative = /^(?:(?:please|you\s+(?:must|should|will|need\s+to))\s+)?(?:do\s+not|never|must|return|respond|output|write|summarize|calculate|extract|classify|compare|explain|list|use|keep|preserve|avoid|include|exclude|ensure|answer|format|delete|generate|translate)\b/i;
export const requestLanguage = /^(?:could|would|can|will)\s+you\b|^(?:the\s+)?(?:task|goal|request)\s*:|\b(?:need|needs)\s+to\b/i;

export function resolveTaskFocus(text: string, settings: Settings): TaskFocus {
    const chunks = originalChunks(text, settings.protectedTerms);
    const nonempty = chunks.filter(c => c.text.trim());
    const { policy, chunkId: requested } = settings.taskFocus;
    if (!['auto', 'user', 'legacy'].includes(policy)) throw new Error('Unknown task-focus policy.');
    const candidates: TaskCandidate[] = nonempty.map(c => {
        const reasons: string[] = [];
        let score = 0;
        // Opaque code/JSON/quoted strings are data, not instructions to the detector.
        const opaque = c.hardProtectionReasons.some(r => /JSON document|Code fence|Inline code|Quoted string/.test(r));
        if (!opaque) {
            if (imperative.test(c.text.trim())) { score += 4; reasons.push('Instruction-like imperative (+4)'); }
            if (/\?/.test(c.text)) { score += 3; reasons.push('Question mark (+3)'); }
            if (requestLanguage.test(c.text.trim())) { score += 2; reasons.push('Request-like language (+2)'); }
            if (c.hardProtectionReasons.includes('Explicit instruction (heuristic)')) { score += 1; reasons.push('Detected protected instruction (+1)'); }
        }
        return { chunkIndex: c.index, chunkId: chunkId(c), score, reasons };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);
    let selected: Chunk | undefined, reason = '', fallback: TaskFocus['fallback'] = 'none';
    if (policy === 'user') {
        selected = nonempty.find(c => chunkId(c) === requested);
        reason = 'User selected an original prompt chunk; selection does not establish task correctness.';
        if (!selected) reason = 'User selection is missing or no longer matches the original chunks.';
    } else if (policy === 'auto') {
        selected = chunks.find(c => c.index === candidates[0]?.chunkIndex);
        reason = selected ? `${candidates[0].reasons.join('; ')}. Highest heuristic score; ties choose the earliest original chunk.` : 'No credible task signal detected.';
    } else {
        selected = nonempty.at(-1);
        reason = 'Legacy assumption: final nonempty chunk of the original prompt.';
    }
    if (!selected) {
        selected = nonempty.at(-1);
        fallback = selected ? 'legacy-final-chunk' : 'empty-input';
        reason += selected ? ' Explicit fallback: final nonempty original chunk.' : ' Empty input: no task focus available.';
    }
    return { algorithm: 'task-focus-v1', policy, chunkIndex: selected?.index ?? null, chunkId: selected ? chunkId(selected) : null,
        start: selected?.start ?? null, end: selected?.end ?? null, text: selected?.text ?? '', reason, fallback, candidates };
}
