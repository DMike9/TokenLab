import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, type Settings, type Method, type Weights } from '../src/engine/types.js';
import { runExperiment } from '../src/engine/runner.js';
import { protectedSpans, protectionRetention, transformUnprotected } from '../src/engine/protection.js';
import { getTokenizer } from '../src/tokenizer/index.js';
import { diffText } from '../src/engine/diff.js';
import { transformScores, TRANSFORMS } from '../src/engine/transforms.js';
import { normalizeVector, vectorMetrics } from '../src/engine/math.js';
import { weightedScore } from '../src/engine/scoring.js';
import { exportData, exportCsv } from '../src/engine/export.js';
import { HARDENING_CORPUS } from './hardening-corpus.js';
import { settingsChanged } from '../src/components/ResultContext.js';
import { getStrategy } from '../src/engine/strategies.js';
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULTS), ...patch });
const methods: Method[] = ['baseline', 'minify', 'deduplicate', 'lexical', 'stopwords', 'importance', 'hybrid'];
const finite = (value: unknown): void => {
    if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
describe('hardening corpus: actual BPE, independent operations and evidence', () => {
    for (const encoding of ['o200k_base', 'cl100k_base', 'r50k_base'] as const) {
        it(encoding, async () => {
            const t = await getTokenizer(encoding);
            for (const [name, original] of HARDENING_CORPUS) for (const method of methods) {
                const r = await runExperiment(original, [method], settings({ encoding, budget: .1 }), () => {});
                expect(r.original, name).toBe(original);
                expect(r.metrics.originalTokens).toBe(t.encode(original).length);
                expect(r.metrics.compressedTokens).toBe(t.encode(r.compressed).length);
                expect(r.metrics.compressedTokens, `${name}/${method}`).toBeLessThanOrEqual(r.metrics.originalTokens);
                expect(r.metrics.protectedRetained).toBe(r.metrics.protectedTotal);
                if (r.budgetMet) expect(r.metrics.compressedTokens).toBeLessThanOrEqual(Math.floor(r.metrics.originalTokens * .1));
                const diff = diffText(original, r.compressed);
                expect(diff.parts.filter(p => p.kind !== 'added').map(p => p.text).join('')).toBe(original);
                expect(diff.parts.filter(p => p.kind !== 'removed').map(p => p.text).join('')).toBe(r.compressed);
                finite(r);
            }
        }, 30000);
    }
});
it('snapshots methods and nested settings before the first await', async () => {
    const draft = settings(), sequence: Method[] = ['baseline'];
    const promise = runExperiment('ordinary background.', sequence, draft, () => {});
    draft.encoding = 'r50k_base'; draft.weights.relevance = 0; draft.taskFocus.policy = 'legacy'; sequence[0] = 'stopwords';
    const r = await promise;
    expect(r.methods).toEqual(['baseline']);
    expect(r.compressed).toBe(r.original);
    expect(r.settings).toEqual(DEFAULTS);
});
it('draft changes must be visible without rewriting recorded evidence', async () => {
    const r = await runExperiment('original text', ['baseline'], settings(), () => {});
    expect(settingsChanged(r, settings(), ['baseline'])).toBe(false);
    for (const patch of [{ encoding: 'cl100k_base' as const }, { weights: { ...DEFAULTS.weights, relevance: 0 } }, { protectedTerms: ['original'] }, { taskFocus: { policy: 'legacy' as const, chunkId: null } }])
        expect(settingsChanged(r, settings(patch), ['baseline'])).toBe(true);
    expect(settingsChanged(r, settings(), ['minify'])).toBe(true);
    expect(r.settings).toEqual(DEFAULTS);
});
it('negation detector explicitly classifies each logical qualifier', () => {
    for (const term of ['NOT', 'not', 'never', 'cannot', 'unless', 'except', 'without', "don't"])
        expect(protectedSpans(`ordinary ${term} background`).some(s => s.text === term && s.reason === 'Negation or logical qualifier')).toBe(true);
});
it('final runner guard rejects expansion and lost original occurrences', async () => {
    const strategy = getStrategy('importance');
    for (const candidate of ['ordinary extra expansion extra expansion NOT NOT', 'ordinary NOT']) {
        const spy = vi.spyOn(strategy, 'compress').mockResolvedValue({ text: candidate, decisions: [], budgetMet: true, notes: [] });
        try {
            const r = await runExperiment('ordinary NOT NOT', ['importance'], settings({ budget: .1 }), () => {});
            expect(r.compressed).toBe('ordinary NOT NOT');
            expect(r.notes.join(' ')).toContain('Candidate rejected');
            expect(r.budgetMet).toBe(false);
        } finally { spy.mockRestore(); }
    }
});
it('all mathematical controls reject nonfinite settings even on baseline/empty input', async () => {
    for (const key of ['budget', 'cutoff', 'temperature', 'steepness', 'center', 'semanticFloor', 'redundancyThreshold', 'ngramSize', 'minimumRepetitions'] as const)
        for (const value of [NaN, Infinity, -Infinity])
            await expect(runExperiment('', ['baseline'], settings({ [key]: value }), () => {})).rejects.toThrow();
    await expect(runExperiment('', ['baseline'], settings({ weights: { ...DEFAULTS.weights, relevance: NaN } }), () => {})).rejects.toThrow();
});
it('sigmoid parameters, feature products and vectors cannot emit nonfinite evidence', () => {
    for (const key of ['steepness', 'center'] as const)
        expect(() => transformScores([.5], { ...DEFAULTS, transform: 'sigmoid', [key]: NaN })).toThrow();
    for (const vector of [[NaN], [Infinity], [0], []]) expect(() => normalizeVector(vector)).toThrow();
    expect(() => vectorMetrics([1e308], [1e308])).toThrow();
    expect(vectorMetrics([1e-100, 0], [0, 1e-100]).cosine).toBe(0);
    expect(() => weightedScore({ ...DEFAULTS.weights, relevance: NaN }, DEFAULTS.weights)).toThrow();
});
it('instruction detector covers adjacent clauses and leading indentation', () => {
    const text = ' Write a report. Return only JSON. Explain the result.';
    const spans = protectedSpans(text).filter(s => s.reason.includes('Explicit instruction'));
    for (const term of ['Write a report.', 'Return only JSON.', 'Explain the result.']) expect(spans.some(s => s.text.includes(term))).toBe(true);
});
it('literal custom terms include every overlapping occurrence and deduplicate declarations', () => {
    const text = 'ababa [x].* "q" 🌱\nnext';
    const terms = ['aba', '[x].*', '"q"', '🌱\nnext', 'aba'];
    const spans = protectedSpans(text, terms).filter(s => s.reason === 'User-protected exact text');
    expect(spans.filter(s => s.text === 'aba').map(s => s.start)).toEqual([0, 2]);
    expect(protectionRetention(text, text, terms).rate).toBe(1);
    expect(protectionRetention('ababa', 'aba', ['aba']).rate).toBe(.5);
    expect(transformUnprotected(text, spans, () => '')).toBe('ababa[x].*"q"🌱\nnext');
    expect(protectedSpans('ABC abc', ['abc']).filter(s => s.reason.startsWith('User')).map(s => s.text)).toEqual(['abc']);
});
it('identifier ablation does not rewrite embedded function words', async () => {
    const text = 'the-file.ts and a-variable and camelCase';
    const r = await runExperiment(text, ['stopwords'], settings(), () => {});
    for (const term of ['the-file.ts', 'a-variable', 'camelCase']) expect(r.compressed).toContain(term);
});
it('math boundaries reconcile the recorded contributions', async () => {
    const zero = Object.fromEntries(Object.keys(DEFAULTS.weights).map(k => [k, 0])) as unknown as Weights;
    for (const transform of TRANSFORMS) for (const budget of [.1, 1]) for (const cutoff of [0, 1]) {
        const r = await runExperiment('ordinary context.\nrare detail.\nDo NOT delete.', ['hybrid'], settings({ transform: transform.id, budget, cutoff,
            temperature: budget === 1 ? 2 : .05, steepness: budget === 1 ? 20 : 1, center: cutoff, weights: cutoff ? zero : Object.fromEntries(Object.keys(zero).map(k => [k, 1])) as unknown as Weights }), () => {});
        finite(r);
        for (const d of r.decisions) expect(Object.values(d.scoring!.contributions).reduce((a, b) => a + b, 0)).toBeCloseTo(d.scoring!.rawScore, 12);
    }
});
it('chain order and final metrics compare actual previous output and original', async () => {
    const original = 'due to the fact that the room is open.\ndue to the fact that the room is open.\nordinary   details.';
    const s = settings({ budget: .5, cutoff: 0 });
    const a = await runExperiment(original, ['lexical'], s, () => {});
    const b = await runExperiment(a.compressed, ['deduplicate'], s, () => {});
    const chain = await runExperiment(original, ['lexical', 'deduplicate'], s, () => {});
    expect(chain.compressed).toBe(b.compressed);
    expect(chain.stages[1].beforeTokens).toBe(a.metrics.compressedTokens);
    expect(chain.metrics.originalTokens).toBe(a.metrics.originalTokens);
});
it('schema-2 exports redact every stage, escape CSV fields and null nonfinite values', async () => {
    const r = await runExperiment('privateSentinel background.\nprivateSentinel extra.', ['hybrid', 'importance'], settings({ protectedTerms: ['privateSentinel'] }), () => {});
    r.id = ' \n=HYPERLINK("test"),🌱'; r.totalMs = Infinity;
    const data = exportData([r], false);
    expect(data).toMatchObject({ format: 'tokenlab-experiments', schemaVersion: 2, includesPromptText: false });
    expect(JSON.stringify(data)).not.toContain('privateSentinel');
    expect(JSON.stringify(exportData([r], true))).toContain('privateSentinel');
    expect(data.experiments[0].totalMs).toBeNull();
    const csv = exportCsv([r]);
    expect(csv).toContain('"\' \n=HYPERLINK(""test""),🌱"');
    expect(csv).not.toContain('Infinity');
    expect(csv).not.toContain('privateSentinel');
});
