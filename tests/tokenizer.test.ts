import { describe, it, expect } from 'vitest';
import { getTokenizer, inspectTokens } from '../src/tokenizer/index.js';
import { calculateMetrics } from '../src/engine/metrics.js';
import { getStrategy } from '../src/engine/strategies.js';
import { DEFAULTS } from '../src/engine/types.js';
import type { Encoding } from '../src/engine/types.js';
import fixture from './fixtures/tiktoken.json';
import hardeningFixture from './fixtures/tiktoken-hardening.json';

describe('independent hardening Unicode/control fixtures', () => {
    for (const [i, sample] of hardeningFixture.cases.entries()) it(`targeted fixture ${i}`, async () => {
        const t = await getTokenizer(sample.encoding as Encoding);
        expect(t.encode(sample.text)).toEqual(sample.ids);
        // Lone UTF-16 surrogates become replacement characters under UTF-8 encoding.
        expect(t.decode(t.encode(sample.text))).toBe(sample.decoded);
        expect(inspectTokens(sample.text, t).total).toBe(sample.ids.length);
    });
});

describe(`independent Python tiktoken ${fixture.version} token IDs`, () => {
    for (const [i, sample] of fixture.cases.entries()) {
        it(`${sample.encoding} fixture ${i}: exact IDs and full decoded string`, async () => {
            const tokenizer = await getTokenizer(sample.encoding as Encoding);
            expect(tokenizer.encode(sample.text)).toEqual(sample.ids);
            expect(tokenizer.decode(sample.ids)).toBe(sample.text);
        });
    }
});
for (const encoding of ['o200k_base', 'cl100k_base', 'r50k_base'] as const)
    describe(encoding, () => {
        it('counts a simple known two-token fixture', async () => { expect((await getTokenizer(encoding)).count('hello world')).toBe(2); });
        for (const text of ['', 'Hi!', 'café 🌱 中文 👩🏽‍💻', '<|endoftext|>', '```js\nconst x = 42;\n```', '{"allow":false}', 'long background '.repeat(1500)])
            it(`round trips ${text.slice(0, 30) || 'empty text'}`, async () => { const t = await getTokenizer(encoding); expect(t.decode(t.encode(text))).toBe(text); });
        it('uses the whole output for token metrics', async () => { const t = await getTokenizer(encoding); const m = calculateMetrics('the ordinary context', 'ordinary context', t.count); expect(m.compressedTokens).toBe(t.encode('ordinary context').length); });
        it('reports the full token count even when visual inspection is capped', async () => { const t = await getTokenizer(encoding); const data = inspectTokens('hello world '.repeat(50), t, 4); expect(data.tokens).toHaveLength(4); expect(data.total).toBe(t.count('hello world '.repeat(50))); });
        it('importance respects the actual BPE budget when feasible', async () => { const t = await getTokenizer(encoding), text = 'ordinary context. extra information. routine details. another generic sentence.'; const out = await getStrategy('importance').compress(text, { count: t.count, settings: { ...DEFAULTS, encoding, budget: .5, cutoff: 0 } }); expect(t.count(out.text)).toBeLessThanOrEqual(Math.floor(t.count(text) * .5)); });
    });
