import { beforeEach, expect, it, vi } from 'vitest';
const seam = vi.hoisted(() => ({ vector: Array(384).fill(1) as number[], fail: false }));
vi.mock('@huggingface/transformers', () => ({ env: { backends: { onnx: { wasm: {} } } }, pipeline: async () => {
    if (seam.fail) throw Error('Injected initialization failure');
    return Object.assign(async () => ({ data: seam.vector }), { tokenizer: (text: string) => ({ input_ids: { data: Array.from(text) } }) });
} }));
beforeEach(() => {
    vi.resetModules(); seam.vector = Array(384).fill(1); seam.fail = false;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sha: 'a'.repeat(40) })));
});
it('model initialization failure is visible and retry can initialize', async () => {
    const model = await import('../src/similarity/embedding.js'); seam.fail = true;
    await expect(model.initializeEmbeddings(() => {})).rejects.toThrow('Injected initialization');
    await expect(model.embedText('text')).rejects.toThrow('not initialized');
    seam.fail = false; await model.initializeEmbeddings(() => {});
    expect((await model.embedText('text')).vector).toHaveLength(384);
});
it('pooling rejects nonfinite, zero and mismatched model vectors before caching', async () => {
    const model = await import('../src/similarity/embedding.js'); await model.initializeEmbeddings(() => {});
    for (const vector of [[1, 2], [], Array(384).fill(NaN), Array(384).fill(Infinity), Array(384).fill(0)]) {
        seam.vector = vector; await expect(model.embedText('same uncached text')).rejects.toThrow();
    }
    seam.vector = Array(384).fill(1);
    const valid = await model.embedText('same uncached text'); expect(Math.hypot(...valid.vector)).toBeCloseTo(1, 12);
    await expect(model.embedText(' \n')).rejects.toThrow('empty');
});
it('model revision must be real-shaped metadata; no prompt appears in download requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ sha: 'main' })));
    const model = await import('../src/similarity/embedding.js'); await expect(model.initializeEmbeddings(() => {})).rejects.toThrow('reproducible');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2');
});
