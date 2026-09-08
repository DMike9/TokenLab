import type { Context, Decision, Method, Strategy, StrategyOutput } from './types.js';
import { protectedSpans, transformUnprotected } from './protection.js';
import { assemble, splitChunks } from './chunks.js';
import { jaccard, ngrams, vectorMetrics } from './math.js';
import { scoreChunks } from './scoring.js';
const result = (text: string, notes: string[] = [], decisions: Decision[] = [], budgetMet: boolean | null = null): StrategyOutput => ({ text, notes, decisions, budgetMet });
function neverExpand(original: string, candidate: string, ctx: Context, notes: string[]): StrategyOutput {
    if (ctx.count(candidate) > ctx.count(original))
        return result(original, [...notes, 'The candidate used more tokens in this encoding, so the original was restored.']);
    return result(candidate, notes);
}
const baseline: Strategy = { id: 'baseline', name: 'Baseline', description: 'Inspect the original BPE tokens. No text removed.', async compress(text) { return result(text, ['Baseline: unchanged text. Tokenization is not compression.']); } };
const minify: Strategy = { id: 'minify', name: 'Structural minify', description: 'Collapse redundant spacing outside detected protected spans.', async compress(text, ctx) {
        const spans = protectedSpans(text, ctx.settings.protectedTerms);
        const candidate = transformUnprotected(text, spans, part => part.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n'));
        return neverExpand(text, candidate, ctx, ['Conservative whitespace heuristic. Detected code, structure and protected text stay byte-for-byte unchanged.', 'Whitespace can carry meaning in unrecognized formats. Inspect the diff.']);
    } };
const deduplicate: Strategy = { id: 'deduplicate', name: 'Redundancy', description: 'Remove repeated context sentences; optionally compare word n-grams.', async compress(text, ctx) {
        const chunks = splitChunks(text, protectedSpans(text, ctx.settings.protectedTerms));
        if (chunks.length > 1500)
            throw new Error('Redundancy mode supports at most 1,500 chunks. Use a shorter selection.');
        const { redundancyThreshold: threshold, ngramSize: n, minimumRepetitions: minimum } = ctx.settings;
        const retained = new Set<number>(), seen: {
            exact: string;
            grams: Set<string>;
            times: number;
        }[] = [];
        const decisions: Decision[] = [];
        for (const c of chunks) {
            const exact = c.text.trim(), grams = ngrams(exact, n);
            const previous = seen.find(s => threshold === 1 ? s.exact === exact : jaccard(s.grams, grams) >= threshold);
            if (previous)
                previous.times++;
            else
                seen.push({ exact, grams, times: 1 });
            const repeated = !!previous && previous.times >= minimum;
            const keep = !!c.reasons.length || !repeated || !exact;
            if (keep)
                retained.add(c.index);
            decisions.push({ index: c.index, text: c.text, originalScore: repeated ? 0 : 1, transformedScore: repeated ? 0 : 1,
                kept: keep, protected: !!c.reasons.length, tokens: ctx.count(c.text), reason: c.reasons.length ? c.reasons.join('; ') : repeated ? `Repeated context; ${threshold === 1 ? 'exact text match' : `word ${n}-gram Jaccard ≥ ${threshold}`}` : 'First / nonmatching context occurrence' });
        }
        const candidate = assemble(chunks, retained);
        if (ctx.count(candidate) > ctx.count(text))
            return result(text, ['Deletion increased this encoding’s token count; original restored.']);
        return result(candidate, [threshold === 1 ? 'Case-sensitive exact sentence/context matching; protected occurrences are not deduplicated.' : 'Approximate lexical overlap is NOT semantic equivalence; near-duplicates can contain different facts.', 'N-gram settings compare whole chunks. This version does not delete arbitrary recurring phrases inside a sentence.'], decisions);
    } };
const LEXICAL_RULES: [
    RegExp,
    string
][] = [
    [/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'], [/\bat this point in time\b/gi, 'now'],
    [/\bin the event that\b/gi, 'if'], [/\bfor the purpose of\b/gi, 'for'], [/\ba large number of\b/gi, 'many'],
    [/\bon a daily basis\b/gi, 'daily'], [/\bin spite of the fact that\b/gi, 'although'], [/\bwith regard to\b/gi, 'about'],
    [/\bin the near future\b/gi, 'soon'], [/\bat a later date\b/gi, 'later'], [/\bin close proximity to\b/gi, 'near'],
];
const lexical: Strategy = { id: 'lexical', name: 'Lexical rewrite', description: 'Try explicit, replaceable rules for verbose expressions.', async compress(text, ctx) {
        const spans = protectedSpans(text, ctx.settings.protectedTerms);
        const candidate = transformUnprotected(text, spans, part => LEXICAL_RULES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), part));
        return neverExpand(text, candidate, ctx, ['Rule-based English rewriting, not a learned compressor. Rules are isolated in engine/strategies.ts.', 'Shorter wording can change nuance. Detected protected content is never rewritten.']);
    } };
const stopwords: Strategy = { id: 'stopwords', name: 'Function-word ablation', description: 'Deliberately damage unprotected prose to expose the tradeoff.', warning: 'High token reduction does not necessarily mean information preservation.', async compress(text, ctx) {
        const candidate = transformUnprotected(text, protectedSpans(text, ctx.settings.protectedTerms), part => part.replace(/\b(?:a|an|the|very|really|basically|actually|somewhat|quite)\b[ \t]*/gi, ''));
        return neverExpand(text, candidate, ctx, ['EXPERIMENTAL ABLATION: grammatical and contextual meaning may be lost.', 'Negations and detected instructions remain protected; this is not a recommended prompt optimizer.']);
    } };
async function importance(text: string, ctx: Context, hybrid: boolean): Promise<StrategyOutput> {
    const chunks = splitChunks(text, protectedSpans(text, ctx.settings.protectedTerms));
    if (chunks.length > 512)
        throw new Error('Importance experiments support at most 512 chunks. Use a shorter selection.');
    if (hybrid && ctx.embed && chunks.length > 64)
        throw new Error('Embedding-guided hybrid scoring supports at most 64 chunks. Use a shorter selection.');
    const decisions = await scoreChunks(text, chunks, ctx, hybrid);
    const budget = Math.floor(ctx.count(text) * ctx.settings.budget);
    const retained = new Set(decisions.filter(d => d.protected).map(d => d.index));
    const cutoff = ctx.settings.transform === 'softmax' ? ctx.settings.cutoff / Math.max(1, decisions.length) : ctx.settings.cutoff;
    for (const d of decisions)
        if (!d.protected) {
            d.kept = false;
            d.reason = d.transformedScore < cutoff ? 'Below shaped-score cutoff' : 'Does not fit the token budget';
        }
    // A transparent greedy heuristic, not a globally optimal knapsack solver. Dividing by variable chunk cost
    // means monotonic shaping CAN change the utility-per-token ranking without changing the raw-score ranking.
    const candidates = decisions.filter(d => !d.protected && d.transformedScore >= cutoff)
        .sort((a, b) => b.transformedScore / Math.max(1, b.tokens) - a.transformedScore / Math.max(1, a.tokens) || a.index - b.index);
    for (const d of candidates) {
        retained.add(d.index);
        if (ctx.count(assemble(chunks, retained)) <= budget) {
            d.kept = true;
            d.reason = 'Passed shaped cutoff and fits greedy value-per-token budget';
        }
        else
            retained.delete(d.index);
    }
    const compressed = assemble(chunks, retained), budgetMet = ctx.count(compressed) <= budget;
    const notes = [
        `Experimental weighted objective. Relevance uses ${hybrid && ctx.embed ? 'local embedding cosine' : 'bag-of-words cosine'}, anchored to the last nonempty chunk.`,
        'Information value is empirical word-frequency surprisal within this prompt, NOT language-model entropy or perplexity.',
        'All scoring weights are heuristics. Protected chunks bypass score filtering; chunk boundaries retain surrounding context.',
        'Monotonic transforms preserve raw rank. Differences arise from a fixed cutoff and utility divided by varying chunk token cost.',
        'Greedy selection is not globally optimal. Every assembled candidate is retokenized; chunk token counts are not assumed additive.',
    ];
    if (ctx.settings.transform === 'softmax')
        notes.push(`Softmax cutoff = slider / chunk count = ${cutoff.toPrecision(4)}; this is a share, not an absolute importance score.`);
    if (!budgetMet)
        notes.push('BUDGET UNMET: detected protected chunks exceed the target. Protection was prioritized over forced savings.');
    return result(compressed, notes, decisions, budgetMet);
}
const similarity: Strategy = { id: 'similarity', name: 'Similarity guard', description: 'Try context deletions; keep only those above a local embedding floor.', async compress(text, ctx) {
        if (!ctx.embed)
            throw new Error('Enable local embeddings before running Similarity guard. No fake similarity fallback is used.');
        if (!text.trim())
            return result(text, ['Embedding similarity is undefined for empty text.']);
        const chunks = splitChunks(text, protectedSpans(text, ctx.settings.protectedTerms));
        if (chunks.length > 96)
            throw new Error('Similarity guard supports at most 96 chunks per run. Try a shorter selection.');
        const decisions = await scoreChunks(text, chunks, ctx, false), retained = new Set(chunks.map(c => c.index));
        const originalVector = (await ctx.embed(text)).vector;
        const budget = Math.floor(ctx.count(text) * ctx.settings.budget);
        const candidates = decisions.filter(d => !d.protected).sort((a, b) => a.originalScore - b.originalScore || b.index - a.index);
        let attempts = 0;
        for (const d of candidates) {
            if (ctx.count(assemble(chunks, retained)) <= budget)
                break;
            retained.delete(d.index);
            const candidate = assemble(chunks, retained);
            attempts++;
            ctx.progress?.(`Similarity guard: testing deletion ${attempts} of ${candidates.length}…`);
            if (!candidate.trim() || ctx.count(candidate) >= ctx.count(assemble(chunks, new Set([...retained, d.index])))) {
                retained.add(d.index);
                d.reason = 'Restored: empty candidate or no token saving';
                continue;
            }
            const sim = vectorMetrics(originalVector, (await ctx.embed(candidate)).vector).cosine;
            if (sim + 1e-8 >= ctx.settings.semanticFloor) {
                d.kept = false;
                d.reason = `Deletion retained: cosine ${sim.toFixed(5)} ≥ floor ${ctx.settings.semanticFloor}`;
            }
            else {
                retained.add(d.index);
                d.reason = `Restored: cosine ${sim.toFixed(5)} below floor ${ctx.settings.semanticFloor}`;
            }
        }
        const compressed = assemble(chunks, retained), budgetMet = ctx.count(compressed) <= budget;
        const out = result(compressed, ['Greedy deletion order can affect the result. Every accepted candidate is compared with the original input to this stage, never just the previous candidate.', 'The cosine floor constrains an embedding proxy, NOT task correctness.', ...(budgetMet ? [] : ['BUDGET UNMET: protected chunks and/or the semantic floor prevented further deletion.'])], decisions, budgetMet);
        out.attempts = attempts;
        return out;
    } };
export const STRATEGIES: Strategy[] = [baseline, minify, deduplicate, lexical, stopwords,
    { id: 'importance', name: 'Importance + math', description: 'Shape transparent heuristic scores; select within a token budget.', compress: (text, ctx) => importance(text, ctx, false) },
    similarity,
    { id: 'hybrid', name: 'Weighted hybrid', description: 'Tune the relevance, information and protection-related feature weights.', compress: (text, ctx) => importance(text, ctx, true) },
];
export const getStrategy = (id: Method): Strategy => { const strategy = STRATEGIES.find(s => s.id === id); if (!strategy)
    throw new Error(`Unknown method: ${id}`); return strategy; };
