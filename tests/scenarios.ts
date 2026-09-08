import { DEFAULTS } from '../src/engine/types.js';
import type { Context, Method, Settings } from '../src/engine/types.js';
import { entropy, normalize, normalizeVector, vectorMetrics, words } from '../src/engine/math.js';
import { transformScores } from '../src/engine/transforms.js';
import { protectedSpans, protectionRetention, transformUnprotected } from '../src/engine/protection.js';
import { splitChunks } from '../src/engine/chunks.js';
import { calculateMetrics, paretoFrontier } from '../src/engine/metrics.js';
import { diffText } from '../src/engine/diff.js';
import { getStrategy } from '../src/engine/strategies.js';
export interface Scenario {
    name: string;
    run: () => void | Promise<void>;
}
const ok = (condition: unknown, message = 'Assertion failed') => { if (!condition)
    throw new Error(message); };
const eq = (a: unknown, b: unknown) => ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const near = (a: number, b: number, tolerance = 1e-8) => ok(Math.abs(a - b) < tolerance, `${a} not near ${b}`);
const rejects = async (fn: () => unknown | Promise<unknown>) => { let failed = false; try {
    await fn();
}
catch {
    failed = true;
} ok(failed, 'Expected rejection'); };
// Dependency-injected character counter validates pure contracts. These are NOT BPE tokenizer tests.
const count = (text: string) => Array.from(text).length;
const context = (settings: Partial<Settings> = {}): Context => ({ count, settings: { ...DEFAULTS, ...settings, weights: { ...DEFAULTS.weights, ...settings.weights } } });
const compress = (method: Method, text: string, settings: Partial<Settings> = {}) => getStrategy(method).compress(text, context(settings));
export const scenarios: Scenario[] = [
    { name: 'metrics: savings, factor and rate use the provided counter', run() { const m = calculateMetrics('abcdefghij', 'abcd', count); eq(m.savedTokens, 6); eq(m.savingsPercent, 60); eq(m.rate, .4); eq(m.factor, 2.5); } },
    { name: 'metrics: empty input does not produce NaN or infinity', run() { const m = calculateMetrics('', '', count); eq(m.rate, null); eq(m.factor, null); eq(m.savingsPercent, 0); eq(m.protectionRate, null); } },
    { name: 'metrics: empty output has no fabricated finite compression factor', run() { eq(calculateMetrics('abc', '', count).factor, null); } },
    { name: 'metrics: expansion is represented with negative savings', run() { eq(calculateMetrics('ab', 'abcd', count).savingsPercent, -100); } },
    { name: 'metrics: Unicode character count is code points', run() { eq(calculateMetrics('a🌱', 'a', count).originalCharacters, 2); } },
    { name: 'math: min-max normalization', run() { eq(normalize([2, 4, 6]), [0, .5, 1]); } },
    { name: 'math: constant and empty normalization', run() { eq(normalize([]), []); eq(normalize([0, 0]), [0, 0]); eq(normalize([4, 4]), [.5, .5]); } },
    { name: 'math: identical and orthogonal vector cosine', run() { near(vectorMetrics([1, 0], [1, 0]).cosine, 1); near(vectorMetrics([1, 0], [0, 1]).cosine, 0); } },
    { name: 'math: negative cosine is not silently clipped to zero', run() { near(vectorMetrics([1, 0], [-1, 0]).cosine, -1); } },
    { name: 'math: distance formulas', run() { const m = vectorMetrics([1, 2], [4, 6]); near(m.euclidean, 5); near(m.manhattan, 7); near(m.dot, 16); } },
    { name: 'math: vectors require nonzero norm and equal dimensions', async run() { await rejects(() => vectorMetrics([0, 0], [1, 1])); await rejects(() => vectorMetrics([1], [1, 2])); } },
    { name: 'math: L2 normalization', run() { const v = normalizeVector([3, 4]); near(v[0], .6); near(v[1], .8); } },
    { name: 'math: empirical entropy is explicitly frequency based', run() { near(entropy('red red'), 0); near(entropy('red blue'), 1); } },
    { name: 'math: Unicode word segmentation retains negated contractions', run() { eq(words("don't café 東京 42"), ["don't", 'café', '東京', '42']); } },
    { name: 'transforms: square and square root', run() { eq(transformScores([0, .5, 1], { ...DEFAULTS, transform: 'square' }), [0, .25, 1]); eq(transformScores([0, .25, 1], { ...DEFAULTS, transform: 'sqrt' }), [0, .5, 1]); } },
    { name: 'transforms: normalized log and exponential endpoints', run() { for (const transform of ['log', 'exp'] as const) {
            const v = transformScores([0, 1], { ...DEFAULTS, transform });
            near(v[0], 0);
            near(v[1], 1);
        } } },
    { name: 'transforms: sigmoid center', run() { near(transformScores([.5], { ...DEFAULTS, transform: 'sigmoid' })[0], .5); } },
    { name: 'transforms: softmax sums to one and stays numerically stable', run() { const v = transformScores([0, .5, 1], { ...DEFAULTS, transform: 'softmax', temperature: .001 }); near(v.reduce((a, b) => a + b, 0), 1); ok(v.every(Number.isFinite)); } },
    { name: 'transforms: lower temperature concentrates probability', run() { const cold = transformScores([.2, .8], { ...DEFAULTS, transform: 'softmax', temperature: .1 }); const hot = transformScores([.2, .8], { ...DEFAULTS, transform: 'softmax', temperature: 1 }); ok(cold[1] > hot[1]); } },
    { name: 'transforms: monotonic functions preserve score order', run() { for (const transform of ['linear', 'square', 'sqrt', 'log', 'exp', 'sigmoid', 'softmax'] as const) {
            const v = transformScores([.2, .5, .8], { ...DEFAULTS, transform });
            ok(v[0] <= v[1] && v[1] <= v[2]);
        } } },
    { name: 'transforms: a fixed threshold makes shaping consequential', run() { const linear = transformScores([.4], DEFAULTS)[0]; const squared = transformScores([.4], { ...DEFAULTS, transform: 'square' })[0]; ok(linear >= .25 && squared < .25); } },
    { name: 'transforms: invalid scores and temperatures are rejected', async run() { await rejects(() => transformScores([NaN], DEFAULTS)); await rejects(() => transformScores([2], DEFAULTS)); await rejects(() => transformScores([.5], { ...DEFAULTS, temperature: 0 })); } },
    { name: 'protection: negation and complete explicit instruction', run() { const spans = protectedSpans('Do NOT delete the database.'); ok(spans.some(s => s.text === 'NOT')); ok(spans.some(s => /instruction/.test(s.reason))); } },
    { name: 'protection: numbers, dates, URLs, identifiers and quotations', run() { const spans = protectedSpans('Meet October 15, 2026 at https://example.com with user_id and "keep me".'); for (const marker of ['Number', 'URL', 'Identifier', 'Quoted'])
            ok(spans.some(s => s.reason.includes(marker)), marker); } },
    { name: 'protection: custom exact phrases', run() { const s = protectedSpans('retain this special phrase', ['special phrase']); ok(s.some(x => x.text === 'special phrase')); } },
    { name: 'protection: duplicate occurrence retention is not presence-only', run() { const s = protectionRetention('NOT. NOT.', 'NOT.'); ok(s.retained < s.total); } },
    { name: 'protection: entire valid JSON is opaque', run() { const s = protectedSpans('{ "name": "the very real value", "amount": 42 }'); eq(s.length, 1); eq(s[0].reason, 'JSON document'); } },
    { name: 'protection: fenced code boundaries remain intact', run() { const text = 'Background.\n```python\nx = 1\nprint(x)\n```\nDone.'; const spans = protectedSpans(text); const code = spans.find(s => s.reason === 'Code fence')!; ok(code.text.includes('print(x)')); const chunks = splitChunks(text, spans); ok(chunks.some(c => c.text.includes(code.text))); } },
    { name: 'protection: transforming gaps never rewrites protected spans', run() { const text = 'boring  prose "the  exact  quote" more  prose'; const out = transformUnprotected(text, protectedSpans(text), t => t.replace(/ {2,}/g, ' ')); ok(out.includes('"the  exact  quote"')); } },
    { name: 'chunks: exact reconstruction including Unicode and whitespace', run() { const text = 'hello 🌱. More context!\n\nlast line'; eq(splitChunks(text).map(c => c.text).join(''), text); } },
    { name: 'diff: reconstructs both strings', run() { const a = 'hello brave world 🌱', b = 'hello new world'; const d = diffText(a, b); eq(d.parts.filter(p => p.kind !== 'added').map(p => p.text).join(''), a); eq(d.parts.filter(p => p.kind !== 'removed').map(p => p.text).join(''), b); } },
    { name: 'diff: identity and empty text', run() { eq(diffText('', '').parts, []); eq(diffText('abc', 'abc').parts, [{ kind: 'same', text: 'abc' }]); } },
    { name: 'diff: coarse long-input fallback is lossless as a diff', run() { const a = 'alpha '.repeat(800), b = 'beta '.repeat(800); const d = diffText(a, b); ok(d.coarse); eq(d.parts.filter(p => p.kind !== 'added').map(p => p.text).join(''), a); eq(d.parts.filter(p => p.kind !== 'removed').map(p => p.text).join(''), b); } },
    { name: 'Pareto: domination is correct and ties survive', run() { const f = paretoFrontier([{ id: 'a', tokens: 10, similarity: .9 }, { id: 'b', tokens: 12, similarity: .8 }, { id: 'c', tokens: 10, similarity: .9 }, { id: 'd', tokens: 8, similarity: .7 }]); ok(f.has('a') && !f.has('b') && f.has('c') && f.has('d')); } },
    { name: 'baseline: exact identity', async run() { eq((await compress('baseline', '  hello 🌱  ')).text, '  hello 🌱  '); } },
    { name: 'minify: reduces repeated unprotected spaces', async run() { eq((await compress('minify', 'the  ordinary   background')).text, 'the ordinary background'); } },
    { name: 'minify: protects Markdown hard breaks', async run() { const text = 'first line  \nsecond line'; eq((await compress('minify', text)).text, text); } },
    { name: 'deduplicate: repeated context is removed', async run() { const out = await compress('deduplicate', 'ordinary context. ordinary context.'); eq(out.text, 'ordinary context. '); } },
    { name: 'deduplicate: exact means case-sensitive', async run() { const text = 'ordinary context. Ordinary context.'; eq((await compress('deduplicate', text)).text, text); } },
    { name: 'deduplicate: repetition-count control is effective', async run() { const text = 'ordinary context. ordinary context.'; eq((await compress('deduplicate', text, { minimumRepetitions: 3 })).text, text); } },
    { name: 'deduplicate: protected repeated instructions survive', async run() { const text = 'Do NOT delete. Do NOT delete.'; eq((await compress('deduplicate', text)).text, text); } },
    { name: 'lexical: deterministic phrase compression', async run() { eq((await compress('lexical', 'due to the fact that the room is open')).text, 'because the room is open'); } },
    { name: 'lexical: quotes never rewritten', async run() { const text = '"in order to" is a phrase'; eq((await compress('lexical', text)).text, text); } },
    { name: 'stopwords: negations always survive', async run() { const out = await compress('stopwords', 'the very ordinary background is not an instruction'); ok(out.text.includes('not')); } },
    { name: 'importance: protected content overrides an impossible budget', async run() { const text = 'Do NOT delete the database.'; const out = await compress('importance', text, { budget: .1 }); eq(out.text, text); eq(out.budgetMet, false); } },
    { name: 'importance: assembled results obey a feasible budget', async run() { const text = 'ordinary context. another routine detail. more background material.'; const out = await compress('importance', text, { budget: .5, cutoff: 0 }); ok(count(out.text) <= Math.floor(count(text) * .5)); } },
    { name: 'importance: deterministic runs match', async run() { const text = 'ordinary context. another detail. more context. Return only a summary.'; const a = await compress('importance', text), b = await compress('importance', text); eq(a, b); } },
    { name: 'hybrid: zero feature weights produce finite values', async run() { const out = await compress('hybrid', 'ordinary context. other prose.', { weights: { relevance: 0, information: 0, instruction: 0, entity: 0, structure: 0, redundancy: 0 } }); ok(out.decisions.every(d => Number.isFinite(d.originalScore))); } },
    { name: 'similarity guard: refuses a fabricated no-model fallback', async run() { await rejects(() => compress('similarity', 'ordinary context.')); } },
    { name: 'similarity guard: every deletion compares to original-stage embedding', async run() { const text = 'ordinary context. important content.'; const seen: string[] = []; const ctx = context({ budget: .6 }); ctx.embed = async (t) => { seen.push(t); return { vector: t.includes('important') ? [1, 0] : [0, 1], chunks: 1 }; }; const out = await getStrategy('similarity').compress(text, ctx); ok(out.text.includes('important')); ok(seen.includes(text)); } },
];
for (const method of ['baseline', 'minify', 'deduplicate', 'lexical', 'stopwords', 'importance', 'hybrid'] as Method[]) {
    scenarios.push({ name: `${method}: empty input`, async run() { eq((await compress(method, '')).text, ''); } });
    scenarios.push({ name: `${method}: structured JSON remains intact`, async run() { const text = '{ "prompt": "the very long phrase", "do_not_delete": true }'; eq((await compress(method, text)).text, text); } });
    scenarios.push({ name: `${method}: preserves negation, number and user-marked phrase`, async run() { const text = 'ordinary background. the very special phrase has 42 units. Do NOT delete the database.'; const out = await compress(method, text, { protectedTerms: ['very special phrase'] }); const retained = protectionRetention(text, out.text, ['very special phrase']); eq(retained.retained, retained.total); } });
}
