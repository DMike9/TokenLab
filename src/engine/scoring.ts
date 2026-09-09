import type { Chunk, Context, Decision, ScoreBreakdown, Weights } from './types.js';
import { DEFAULTS } from './types.js';
import { clamp, frequencies, jaccard, lexicalCosine, ngrams, vectorMetrics, words } from './math.js';
import { transformScores } from './transforms.js';
import { imperative, requestLanguage, resolveTaskFocus } from './taskFocus.js';

/** Text observations only: changing protection labels cannot change these features. */
export function softSignals(text: string): Pick<Weights, 'instruction' | 'entity' | 'structure'> {
    const trimmed = text.trim();
    const instruction = imperative.test(trimmed) || requestLanguage.test(trimmed) || /\?/.test(text) ? 1 : 0;
    // Weak named-item signal, not NER. Sentence-initial single names may be missed.
    const afterFirst = trimmed.replace(/^\S+\s*/, '');
    const entity = /\d|\b[A-Z]{2,}\b|\b\w+_\w+\b|https?:\/\//.test(text) || /\b[A-Z][a-z]{2,}\b/.test(afterFirst) ? 1 : 0;
    const structure = /^(?:[ \t]*#{1,6}\s|[ \t]*[-*+>]\s|[ \t]*\||[ \t]{4,}|[ \t]*[\p{L}][\p{L} \t]{0,40}:)|```|~~~|<\/?[A-Za-z]|^[\s]*[\[{]/mu.test(text) ? 1 : 0;
    return { instruction, entity, structure };
}
export function weightedScore(features: Weights, weights: Weights): Pick<ScoreBreakdown, 'contributions' | 'positiveWeightSum' | 'rawScore'> {
    if (!Object.values(weights).every(w => Number.isFinite(w) && w >= 0)) throw new Error('Importance weights must be finite and nonnegative.');
    const positiveWeightSum = weights.relevance + weights.information + weights.instruction + weights.entity + weights.structure;
    const term = (key: keyof Weights) => positiveWeightSum ? features[key] * weights[key] / positiveWeightSum : 0;
    const contributions: Weights = { relevance: term('relevance'), information: term('information'), instruction: term('instruction'),
        entity: term('entity'), structure: term('structure'), redundancy: -weights.redundancy * features.redundancy };
    return { contributions, positiveWeightSum, rawScore: Object.values(contributions).reduce((a, b) => a + b, 0) };
}
export async function scoreChunks(original: string, chunks: Chunk[], context: Context, hybrid: boolean): Promise<Decision[]> {
    const f = frequencies(original), total = [...f.values()].reduce((a, b) => a + b, 0);
    const weights = hybrid ? context.settings.weights : DEFAULTS.weights;
    const focus = context.taskFocus ?? resolveTaskFocus(original, context.settings);
    const task = focus.text;
    const useSemantic = hybrid && !!context.embed;
    const taskVector = useSemantic && task.trim() ? (await context.embed!(task)).vector : undefined;
    const seen: Set<string>[] = [], raw: number[] = [], breakdowns: ScoreBreakdown[] = [];
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
        const features: Weights = { relevance, information, ...softSignals(chunk.text), redundancy };
        const breakdown: ScoreBreakdown = { features, weights: { ...weights }, ...weightedScore(features, weights),
            relevanceMetric: !task.trim() || !chunk.text.trim() ? 'missing-empty-text' : useSemantic ? 'embedding-cosine' : 'lexical-cosine', focusId: focus.chunkId,
            ...(useSemantic && context.embeddingModel ? { embeddingModel: { ...context.embeddingModel } } : {}) };
        breakdowns.push(breakdown);
        raw.push(clamp(breakdown.rawScore));
    }
    const shaped = transformScores(raw, context.settings);
    return chunks.map((chunk, i) => ({
        index: chunk.index, text: chunk.text, originalScore: raw[i], transformedScore: shaped[i], kept: true,
        hardProtected: chunk.hardProtected, hardProtectionReasons: [...chunk.hardProtectionReasons], scoring: breakdowns[i],
        protected: chunk.hardProtected, reason: chunk.hardProtected ? chunk.hardProtectionReasons.join('; ') : 'Eligible context chunk', tokens: context.count(chunk.text),
    }));
}
