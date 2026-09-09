import { embeddingWindows } from './windows.js';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { normalizeVector } from '../engine/math.js';
export const MODEL = 'Xenova/all-MiniLM-L6-v2';
export const DTYPE = 'q8';
let extractor: FeatureExtractionPipeline | null = null;
let revision = '';
const embeddingCache = new Map<string, {
    vector: number[];
    chunks: number;
}>();
export const modelRevision = () => revision;
async function resolveRevision(): Promise<string> {
    const url = `https://huggingface.co/api/models/${MODEL}`;
    // This cache contains ONLY a public model manifest, never prompt text or embeddings.
    let cache: Cache | undefined;
    try {
        if (typeof caches !== 'undefined')
            cache = await caches.open('tokenlab-model-manifest-v1');
    }
    catch { /* Storage is optional. */ }
    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok)
            throw new Error(`Model metadata returned ${response.status}.`);
        if (cache) {
            try {
                await cache.put(url, response.clone());
            }
            catch { /* Continue without persistent model metadata. */ }
        }
    }
    catch (error) {
        const cached = await cache?.match(url);
        if (!cached)
            throw error;
        response = cached;
    }
    const data = await response.json() as {
        sha?: string;
    };
    if (!data.sha || !/^[a-f0-9]{40}$/i.test(data.sha))
        throw new Error('Could not resolve a reproducible model revision.');
    return data.sha;
}
export async function initializeEmbeddings(progress: (text: string) => void): Promise<void> {
    if (extractor)
        return;
    progress('Preparing local embeddings. Downloading public model files; no prompt text is sent.');
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends.onnx.wasm)
        env.backends.onnx.wasm.numThreads = 1;
    revision = await resolveRevision();
    extractor = await pipeline<'feature-extraction'>('feature-extraction', MODEL, {
        device: 'wasm', dtype: DTYPE, revision,
        progress_callback: (event: {
            status: string;
            file?: string;
            progress?: number;
        }) => {
            if (event.status === 'progress')
                progress(`Downloading local model ${event.file ?? ''} · ${Math.round(event.progress ?? 0)}%`);
        },
    });
    progress('Local embedding model is ready. Inference stays in this browser worker.');
}
export function clearEmbeddingTextCache() { embeddingCache.clear(); }
export async function embedText(text: string): Promise<{
    vector: number[];
    chunks: number;
}> {
    if (!extractor)
        throw new Error('The local embedding model is not initialized.');
    if (!text.trim())
        throw new Error('Embedding similarity is undefined for empty text.');
    const cached = embeddingCache.get(text);
    if (cached)
        return cached;
    const model = extractor;
    const tokenLength = (part: string): number => {
        const encoded = model.tokenizer(part, { add_special_tokens: false, truncation: false, padding: false });
        return encoded.input_ids.data.length;
    };
    const pieces = embeddingWindows(text, tokenLength);
    let weighted: number[] | undefined;
    for (const piece of pieces) {
        const output = await model(piece.text, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data, Number);
        if (vector.length !== 384 || vector.some(v => !Number.isFinite(v)))
            throw new Error('Local model returned invalid dimensions or nonfinite vector values; similarity was not computed.');
        normalizeVector(vector); // Also reject a zero vector before pooling can conceal it.
        if (!weighted)
            weighted = vector.map(() => 0);
        for (let i = 0; i < vector.length; i++)
            weighted[i] += vector[i] * piece.weight;
    }
    const value = { vector: normalizeVector(weighted!), chunks: pieces.length };
    if (embeddingCache.size >= 128)
        embeddingCache.delete(embeddingCache.keys().next().value!);
    embeddingCache.set(text, value);
    return value;
}
