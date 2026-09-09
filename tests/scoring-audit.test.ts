import { describe, expect, it } from 'vitest';
import { scoreChunks } from '../src/engine/scoring.js';
import { splitChunks } from '../src/engine/chunks.js';
import { protectedSpans } from '../src/engine/protection.js';
import { getStrategy } from '../src/engine/strategies.js';
import { DEFAULTS, type Context, type Weights } from '../src/engine/types.js';

const zero: Weights = { relevance: 0, information: 0, instruction: 0, entity: 0, structure: 0, redundancy: 0 };
const context = (weights: Weights): Context => ({ count: t => t.length, settings: { ...structuredClone(DEFAULTS), taskFocus: { policy: 'legacy', chunkId: null }, weights, cutoff: 0, budget: 1 } });

describe('scoring characterization captured before Phase 2 changes', () => {
    it('uses the final nonempty chunk as the lexical anchor', async () => {
        const text = 'alpha.\nbeta.\n\n';
        const rows = await scoreChunks(text, splitChunks(text), context({ ...zero, relevance: 1 }), true);
        expect(rows[0].originalScore).toBe(0);
        expect(rows.find(d => d.text.trim() === 'beta.')?.originalScore).toBe(1);
    });

    for (const feature of ['instruction', 'entity', 'structure'] as const) {
        it(`${feature} weights cannot remove already protected chunks, even at zero score and impossible budget`, async () => {
            const text = 'Write a report.\n42.\n# heading\nbackground prose.\n';
            const low = context(zero), high = context({ ...zero, [feature]: 10 });
            low.settings.cutoff = high.settings.cutoff = 1;
            low.settings.budget = high.settings.budget = 0;
            const a = await getStrategy('hybrid').compress(text, low);
            const b = await getStrategy('hybrid').compress(text, high);
            expect(a.text).toBe(b.text);
            expect(a.budgetMet).toBe(false);
            expect(a.decisions.filter(d => d.protected).map(d => d.text)).toEqual(splitChunks(text, protectedSpans(text)).filter(c => c.reasons.length).map(c => c.text));
            expect(a.decisions.filter(d => d.protected).every(d => d.kept && d.originalScore === 0)).toBe(true);
            expect(b.decisions.filter(d => d.protected).every(d => d.kept)).toBe(true);
            expect(protectedSpans(text).every(s => a.text.includes(s.text))).toBe(true);
        });

        it(`${feature} denominator changes eligible ranking relative to a fixed redundancy penalty`, async () => {
            const text = 'alpha.\nalpha beta.\nalpha beta.\n';
            const chunks = splitChunks(text, protectedSpans(text));
            expect(chunks.every(c => c.reasons.length === 0)).toBe(true);
            const low = await scoreChunks(text, chunks, context({ ...zero, relevance: 1, redundancy: .2 }), true);
            const high = await scoreChunks(text, chunks, context({ ...zero, relevance: 1, redundancy: .2, [feature]: 10 }), true);
            const last = [...low].reverse().find(d => d.text.trim() === 'alpha beta.')!;
            const lastHigh = high.find(d => d.index === last.index)!;
            expect(last.originalScore).toBeCloseTo(.8);
            expect(last.originalScore).toBeGreaterThan(low[0].originalScore);
            expect(high[0].originalScore).toBeCloseTo(low[0].originalScore / 11);
            expect(lastHigh.originalScore).toBe(0);
            expect(high[0].originalScore).toBeGreaterThan(lastHigh.originalScore);
        });
    }
});
