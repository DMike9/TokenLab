import type { Chunk, Context, Decision } from './types.js';
import { DEFAULTS } from './types.js';
import { clamp, frequencies, jaccard, lexicalCosine, ngrams, vectorMetrics, words } from './math.js';
import { transformScores } from './transforms.js';
export async function scoreChunks(original: string, chunks: Chunk[], context: Context, hybrid: boolean): Promise<Decision[]> {
    const f = frequencies(original), total = [...f.values()].reduce((a, b) => a + b, 0);
    const weights = hybrid ? context.settings.weights : DEFAULTS.weights;
    const positiveSum = weights.relevance + weights.information + weights.instruction + weights.entity + weights.structure;
    const task = [...chunks].reverse().find(c => c.text.trim())?.text ?? original;
    const useSemantic = hybrid && !!context.embed;
    const taskVector = useSemantic ? (await context.embed!(task)).vector : undefined;
    const seen: Set<string>[] = [], raw: number[] = [];
    for (const chunk of chunks) {
        const ws = words(chunk.text.toLocaleLowerCase('en'));
        const information = ws.length && total > 1 ? ws.reduce((s, w) => s - Math.log2((f.get(w) ?? 1) / total), 0) / ws.length / Math.log2(total) : 0;
        const grams = ngrams(chunk.text, 2), redundancy = seen.length ? Math.max(...seen.map(s => jaccard(s, grams))) : 0;
        seen.push(grams);
        let relevance = lexicalCosine(chunk.text, task);
        if (taskVector && chunk.text.trim()) {
            context.progress?.(`Scoring chunk ${chunk.index + 1} of ${chunks.length} locally…`);
            relevance = clamp(vectorMetrics((await context.embed!(chunk.text)).vector, taskVector).cosine);
        }
        const instruction = chunk.reasons.some(r => /instruction|Negation/.test(r)) ? 1 : 0;
        const entity = chunk.reasons.some(r => /Number|proper noun|Identifier|URL|Quoted|User-protected/.test(r)) ? 1 : 0;
        const structure = chunk.reasons.some(r => /Code|JSON|Markdown|XML/.test(r)) ? 1 : 0;
        const positive = weights.relevance * relevance + weights.information * information + weights.instruction * instruction + weights.entity * entity + weights.structure * structure;
        raw.push(clamp((positiveSum ? positive / positiveSum : 0) - weights.redundancy * redundancy));
    }
    const shaped = transformScores(raw, context.settings);
    return chunks.map((chunk, i) => ({
        index: chunk.index, text: chunk.text, originalScore: raw[i], transformedScore: shaped[i], kept: true,
        protected: chunk.reasons.length > 0, reason: chunk.reasons.length ? chunk.reasons.join('; ') : 'Unprotected context chunk', tokens: context.count(chunk.text),
    }));
}
