import type { Method, Run, Settings, Similarity, Stage } from './types.js';
import { MAX_CHARACTERS } from './types.js';
import { getTokenizer } from '../tokenizer/index.js';
import { getStrategy } from './strategies.js';
import { calculateMetrics } from './metrics.js';
import { protectionRetention } from './protection.js';
import { vectorMetrics } from './math.js';
import { DTYPE, MODEL, embedText, modelRevision } from '../similarity/embedding.js';
import { resolveTaskFocus } from './taskFocus.js';
import { validateSettings } from './settings.js';
export const ENGINE_VERSION = 'tokenlab-0.3.0';
export async function hashText(text: string): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}
export async function runExperiment(original: string, methods: Method[], settings: Settings, progress: (text: string) => void): Promise<Run> {
    // Capture caller-owned arrays/objects before any asynchronous dependency work.
    settings = structuredClone(settings);
    methods = [...methods];
    validateSettings(settings);
    if (original.length > MAX_CHARACTERS)
        throw new Error(`Input exceeds ${MAX_CHARACTERS.toLocaleString()} UTF-16 code units. Shorten it before running.`);
    if (!methods.length || methods.length > 8)
        throw new Error('Choose between one and eight operations.');
    if (![settings.budget, settings.cutoff, settings.semanticFloor, settings.redundancyThreshold].every(n => Number.isFinite(n) && n >= 0 && n <= 1))
        throw new Error('Budget and thresholds must be in [0, 1].');
    const start = performance.now(), tokenizer = await getTokenizer(settings.encoding);
    const taskFocus = resolveTaskFocus(original, settings);
    taskFocus.textHash = await hashText(taskFocus.text);
    const ctx = { settings, taskFocus, count: tokenizer.count, embed: settings.useEmbeddings ? embedText : undefined, progress,
        embeddingModel: settings.useEmbeddings ? { model: MODEL, revision: modelRevision(), dtype: DTYPE } : undefined };
    let current = original, decisions: Run['decisions'] = [], budgetMet: boolean | null = null;
    const notes: string[] = [], stages: Stage[] = [];
    const compressionStart = performance.now();
    for (const method of methods) {
        progress(`Running ${getStrategy(method).name}…`);
        const before = current, out = await getStrategy(method).compress(current, ctx);
        current = out.text;
        decisions = out.decisions;
        budgetMet = out.budgetMet;
        // Defense in depth: check the ORIGINAL protected occurrences after every chain stage.
        const protectedStatus = protectionRetention(original, current, settings.protectedTerms);
        if (protectedStatus.retained < protectedStatus.total || tokenizer.count(current) > tokenizer.count(before)) {
            current = before;
            decisions = [];
            budgetMet = ['importance', 'hybrid', 'similarity'].includes(method)
                ? tokenizer.count(before) <= Math.floor(tokenizer.count(before) * settings.budget) : null;
            out.notes.push('Candidate rejected by the final guard: an original protected occurrence was lost or token count increased. Prior text restored.');
        }
        notes.push(...out.notes);
        stages.push({ method, beforeTokens: tokenizer.count(before), afterTokens: tokenizer.count(current), notes: out.notes, decisions });
    }
    const compressionMs = performance.now() - compressionStart;
    let similarity: Similarity | null = null, similarityError: string | null = null;
    if (settings.useEmbeddings && original.trim() && current.trim()) {
        const begin = performance.now();
        try {
            progress('Measuring local embedding similarity…');
            const a = await embedText(original), b = await embedText(current);
            similarity = { ...vectorMetrics(a.vector, b.vector), model: MODEL, revision: modelRevision(), dtype: DTYPE,
                originalChunks: a.chunks, compressedChunks: b.chunks, aggregation: 'model-token-weighted mean of normalized ≤254-wordpiece chunk embeddings, followed by L2 normalization', elapsedMs: performance.now() - begin };
        }
        catch (error) {
            similarityError = error instanceof Error ? error.message : 'Local embedding measurement failed.';
        }
    }
    if (methods.length > 1)
        notes.push('Chain score decisions refer to the LAST stage’s input, while the final diff and similarity compare against the original prompt.');
    return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), engineVersion: ENGINE_VERSION,
        inputHash: await hashText(original), outputHash: await hashText(current), original, compressed: current,
        methods, taskFocus, settings: structuredClone(settings), metrics: calculateMetrics(original, current, tokenizer.count, settings.protectedTerms),
        similarity, similarityError, decisions, notes: [...new Set(notes)], budgetMet, compressionMs,
        totalMs: performance.now() - start, stages,
    };
}
