import { expect, it } from 'vitest';
import { DEFAULTS, MAX_CHARACTERS, type Method } from '../src/engine/types.js';
import { runExperiment } from '../src/engine/runner.js';
import { getStrategy } from '../src/engine/strategies.js';
import { getTokenizer, inspectTokens } from '../src/tokenizer/index.js';
import { embeddingWindows } from '../src/similarity/windows.js';
import { splitChunks } from '../src/engine/chunks.js';
import { protectedSpans } from '../src/engine/protection.js';

it('overall MAX-1/MAX/MAX+1 and local maximum-input observation', async () => {
    const start = performance.now();
    for (const n of [MAX_CHARACTERS - 1, MAX_CHARACTERS, MAX_CHARACTERS + 1]) {
        const text = 'ordinary background. '.repeat(3000).slice(0, n);
        const p = runExperiment(text, ['baseline'], structuredClone(DEFAULTS), () => {});
        if (n > MAX_CHARACTERS) await expect(p).rejects.toThrow('60,000');
        else { const r = await p; expect(r.compressed).toBe(text); expect(r.metrics.originalTokens).toBeGreaterThan(0); }
    }
    console.info(`Local input-limit observation: ${(performance.now() - start).toFixed(0)}ms; Node heap ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MiB (not a benchmark).`);
}, 30000);
for (const [method, max, model] of [['deduplicate', 1500, false], ['importance', 512, false], ['hybrid', 64, true], ['similarity', 96, true]] as const)
    it(`${method} chunk MAX-1/MAX/MAX+1 rejects rather than truncates`, async () => {
        const t = await getTokenizer('o200k_base');
        for (const n of [max - 1, max, max + 1]) {
            const text = 'context\n'.repeat(n);
            // Explicit vector seam isolates admission limits; real inference is checked separately.
            const p = getStrategy(method as Method).compress(text, { count: t.count, settings: { ...structuredClone(DEFAULTS), budget: 1, cutoff: 0 },
                ...(model ? { embed: async () => ({ vector: [1, 0], chunks: 1 }) } : {}) });
            if (n > max) await expect(p).rejects.toThrow(/at most/);
            else { const r = await p; expect(r.decisions).toHaveLength(n); expect(t.count(r.text)).toBeLessThanOrEqual(t.count(text)); }
        }
    }, 30000);
it('embedding windows preserve exact Unicode substrings at 127/128/129 windows', () => {
    // Code-point counter is a windowing test seam, NOT the embedding tokenizer.
    const count = (s: string) => Array.from(s).length;
    for (const n of [127, 128, 129]) {
        const text = '🌱'.repeat(254 * n);
        if (n > 128) expect(() => embeddingWindows(text, count)).toThrow('No truncated score');
        else { const pieces = embeddingWindows(text, count); expect(pieces).toHaveLength(n); expect(pieces.map(p => p.text).join('')).toBe(text); expect(pieces.every(p => p.weight === 254)).toBe(true); }
    }
    expect(() => embeddingWindows(' ', count)).toThrow('no content');
});
it('inspector cap boundaries keep the independent full-document total', async () => {
    const t = await getTokenizer('o200k_base');
    for (const n of [1999, 2000, 2001]) {
        const text = ' x'.repeat(n); expect(t.encode(text)).toHaveLength(n);
        const data = inspectTokens(text, t); expect(data.total).toBe(n); expect(data.tokens).toHaveLength(Math.min(n, 2000));
    }
});
it('maximum dense protection reconstructs every line and nested/adjacent spans exactly', () => {
    const text = '1\n'.repeat(30000);
    const chunks = splitChunks(text, protectedSpans(text));
    expect(chunks).toHaveLength(30000);
    expect(chunks.map(c => c.text).join('')).toBe(text);
    expect(chunks.every(c => c.hardProtected)).toBe(true);
    const nested = 'aa\nbb\ncc\ndd';
    const spans = [ {start:0,end:5,text:'aa\nbb',reason:'outer'}, {start:3,end:5,text:'bb',reason:'inner'}, {start:6,end:8,text:'cc',reason:'adjacent'} ];
    const result = splitChunks(nested, spans);
    expect(result.map(c => c.text)).toEqual(['aa\nbb\n', 'cc\n', 'dd']);
    expect(result.map(c => c.reasons)).toEqual([['outer','inner'], ['adjacent'], []]);
});
