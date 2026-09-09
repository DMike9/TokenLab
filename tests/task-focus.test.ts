import { describe, expect, it } from 'vitest';
import { DEFAULTS, type Run, type Settings, type Weights } from '../src/engine/types.js';
import { chunkId, originalChunks, resolveTaskFocus } from '../src/engine/taskFocus.js';
import { scoreChunks, softSignals, weightedScore } from '../src/engine/scoring.js';
import { getStrategy } from '../src/engine/strategies.js';
import { protectionRetention } from '../src/engine/protection.js';
import { lexicalCosine, words } from '../src/engine/math.js';
import { runExperiment, hashText } from '../src/engine/runner.js';
import { exportCsv, exportData } from '../src/engine/export.js';
import { EXAMPLES } from '../src/examples.js';

const zero: Weights = { relevance: 0, information: 0, instruction: 0, entity: 0, structure: 0, redundancy: 0 };
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULTS), ...patch });
// Word-count seam isolates preference from variable BPE costs. Runner tests below use real BPE.
const compress = (text: string, weights: Weights, patch: Partial<Settings> = {}) => getStrategy('hybrid').compress(text, {
    count: t => words(t).length, settings: settings({ weights, budget: .5, cutoff: .1, ...patch }) });

describe('task focus from one original prompt', () => {
    it('detects the teaching task before final background', () => {
        const text = EXAMPLES.find(e => e.id === 'task-focus')!.text;
        const focus = resolveTaskFocus(text, settings());
        expect(focus.chunkIndex).toBe(0);
        expect(focus.text).toBe('Summarize the orchard irrigation risk.');
        expect(focus.fallback).toBe('none');
        expect(focus.reason).toContain('imperative');
        expect(resolveTaskFocus(text, settings({ taskFocus: { policy: 'legacy', chunkId: null } })).text).toContain('butterflies');
    });
    it('ranks multiple candidates deterministically and breaks ties by original position', () => {
        const focus = resolveTaskFocus('background.\nWrite a report.\nSummarize the findings.\nfinal background.', settings());
        expect(focus.text).toContain('Write a report.');
        expect(focus.candidates.length).toBe(2);
        expect(focus.candidates.map(c => c.score)).toEqual([5, 5]);
        expect(focus.reason).toContain('earliest');
    });
    it('detects questions and request language independently of protected instructions', () => {
        const focus = resolveTaskFocus('background.\ncould you help?\nfinal background.', settings());
        expect(focus.text).toContain('could you help?');
        expect(focus.candidates[0].score).toBe(5);
        expect(originalChunks(focus.text, []).every(c => !c.hardProtected)).toBe(true);
    });
    it('does not detect instructions inside opaque JSON, code, or quotes', () => {
        for (const text of ['{"task":"Write a report?"}', '```txt\nWrite a report?\n```', '"Write a report?"']) {
            const focus = resolveTaskFocus(text, settings());
            expect(focus.candidates).toEqual([]);
            expect(focus.fallback).toBe('legacy-final-chunk');
        }
    });
    it('records missing detection, empty input and invalid user-selection fallback', () => {
        const text = 'background prose.\nfinal context.';
        const auto = resolveTaskFocus(text, settings());
        expect(auto.fallback).toBe('legacy-final-chunk');
        expect(auto.reason).toContain('No credible');
        expect(auto.text).toBe('final context.');
        const invalid = resolveTaskFocus(text, settings({ taskFocus: { policy: 'user', chunkId: 'stale-id' } }));
        expect(invalid.fallback).toBe('legacy-final-chunk');
        expect(invalid.reason).toContain('no longer matches');
        const empty = resolveTaskFocus(' \n', settings());
        expect(empty.fallback).toBe('empty-input');
        expect(empty.chunkIndex).toBeNull();
    });
    it('user selects an exact original slice; changed text invalidates its identifier', () => {
        const text = 'alpha context.\nbeta context.';
        const chunk = originalChunks(text, [])[0];
        const s = settings({ taskFocus: { policy: 'user', chunkId: chunkId(chunk) } });
        const focus = resolveTaskFocus(text, s);
        expect(focus.text).toBe(text.slice(focus.start!, focus.end!));
        expect(focus.chunkIndex).toBe(0);
        expect(focus.fallback).toBe('none');
        expect(resolveTaskFocus(text.replace('alpha', 'gamma'), s).fallback).toBe('legacy-final-chunk');
    });
    it('anchor policies change relevance but not the original or protected content', async () => {
        const text = 'Summarize orchard irrigation.\norchard irrigation.\ngarden butterflies.';
        const first = originalChunks(text, [])[0];
        const runs: Run[] = [];
        for (const policy of ['auto', 'user', 'legacy'] as const) {
            const run = await runExperiment(text, ['hybrid'], settings({ taskFocus: { policy, chunkId: policy === 'user' ? chunkId(first) : null }, weights: { ...zero, relevance: 1 }, budget: .1 }), () => {});
            runs.push(run);
            expect(run.original).toBe(text);
            expect(run.inputHash).toBe(await hashText(text));
            expect(run.taskFocus.textHash).toBe(await hashText(run.taskFocus.text));
            expect(run.settings.taskFocus.policy).toBe(policy);
            expect(run.metrics.protectedRetained).toBe(run.metrics.protectedTotal);
            expect(run.budgetMet).toBe(false);
        }
        const relevance = (i: number) => runs[i].decisions.find(d => d.text.trim() === 'orchard irrigation.')!.scoring!.features.relevance;
        expect(relevance(0)).toBeGreaterThan(relevance(2));
        expect(relevance(0)).toBe(relevance(1));
    });
    it('chain scoring keeps the original selected focus after an earlier rewrite', async () => {
        const text = 'at this point in time the orchard thrives.\nbackground prose.';
        const focusChunk = originalChunks(text, [])[0];
        const run = await runExperiment(text, ['lexical', 'hybrid'], settings({ taskFocus: { policy: 'user', chunkId: chunkId(focusChunk) }, budget: 1, cutoff: 0 }), () => {});
        expect(run.stages[0].afterTokens).toBeLessThan(run.stages[0].beforeTokens);
        expect(run.taskFocus.text).toBe(focusChunk.text);
        const d = run.decisions.find(d => d.text.includes('now'))!;
        expect(d.scoring!.focusId).toBe(run.taskFocus.chunkId);
        expect(d.scoring!.features.relevance).toBeCloseTo(lexicalCosine(d.text, focusChunk.text));
        expect(d.scoring!.features.relevance).toBeLessThan(1);
        expect(run.stages[1].decisions).toEqual(run.decisions);
    });
    it('JSON and CSV keep focus/scoring reproducibility without leaking text', async () => {
        const text = 'Summarize privateorchard.\nprivateorchard background.';
        const run = await runExperiment(text, ['hybrid', 'importance'], settings({ protectedTerms: ['privateorchard'] }), () => {});
        const redacted = exportData([run], false);
        const serialized = JSON.stringify(redacted);
        expect(serialized).not.toContain('privateorchard');
        expect(serialized).toContain(run.taskFocus.textHash!);
        expect(serialized).toContain('contributions');
        expect(redacted.schemaVersion).toBe(2);
        expect(redacted.warning).toContain('not anonymization');
        expect(JSON.stringify(exportData([run], true))).toContain('privateorchard');
        const csv = exportCsv([run]);
        expect(csv).not.toContain('privateorchard');
        expect(csv).toContain('task_focus_sha256');
        expect(csv).toContain(run.taskFocus.textHash!);
    });
});

describe('hard constraints and interpretable soft features', () => {
    it('does not label empty-chunk zeroes as measured embedding relevance', async () => {
        let calls = 0;
        const text = ' \n';
        const rows = await scoreChunks(text, originalChunks(text, []), { settings: settings(), count: t => t.length,
            embed: async () => { calls++; return { vector: [1, 0], chunks: 1 }; } }, true);
        expect(calls).toBe(0);
        expect(rows.every(d => d.scoring!.relevanceMetric === 'missing-empty-text')).toBe(true);
        expect(rows.every(d => d.scoring!.contributions.relevance === 0)).toBe(true);
    });
    it('soft observations are independent of custom protection labels', async () => {
        const text = 'orchards near Kyoto thrive.';
        expect(softSignals(text)).toEqual({ instruction: 0, entity: 1, structure: 0 });
        const a = originalChunks(text, []), b = originalChunks(text, ['Kyoto']);
        expect(a[0].hardProtected).toBe(false);
        expect(b[0].hardProtected).toBe(true);
        const ctx = { settings: settings(), count: (t: string) => t.length };
        const low = await scoreChunks(text, a, ctx, true), high = await scoreChunks(text, b, ctx, true);
        expect(low[0].scoring).toEqual(high[0].scoring);
        expect(high[0].hardProtectionReasons).toContain('User-protected exact text');
    });
    it('records the actual normalized positive contributions and negative penalty', () => {
        const features = { relevance: .72, information: .51, instruction: 1, entity: 0, structure: 0, redundancy: .38 };
        const weights = { relevance: .4, information: .2, instruction: .2, entity: .1, structure: .1, redundancy: .2 };
        const result = weightedScore(features, weights);
        expect(result.positiveWeightSum).toBeCloseTo(1);
        expect(result.contributions.relevance).toBeCloseTo(.288);
        expect(result.contributions.information).toBeCloseTo(.102);
        expect(result.contributions.instruction).toBeCloseTo(.2);
        expect(result.contributions.redundancy).toBeCloseTo(-.076);
        expect(result.rawScore).toBeCloseTo(.514);
        expect(weightedScore(features, { ...zero, relevance: 2, information: 2 }).contributions.relevance).toBeCloseTo(.36);
        expect(weightedScore(features, zero).rawScore).toBe(0);
        expect(() => weightedScore(features, { ...zero, entity: NaN })).toThrow('finite');
    });
    it('relevance versus information chooses different eligible competitors', async () => {
        const text = 'common common.\nrare unique.\ncommon common.';
        const patch = { budget: .34, taskFocus: { policy: 'legacy' as const, chunkId: null } };
        const relevant = await compress(text, { ...zero, relevance: 1 }, patch);
        const informative = await compress(text, { ...zero, information: 1 }, patch);
        expect(relevant.decisions.every(d => !d.hardProtected)).toBe(true);
        expect(relevant.text.trim()).toBe('common common.');
        expect(informative.text.trim()).toBe('rare unique.');
    });
    it('redundancy penalty changes admission of eligible repeated context', async () => {
        const text = 'alpha beta.\nalpha beta.\ngamma delta.';
        const a = await compress(text, { ...zero, information: 1 }, { budget: 1 });
        const b = await compress(text, { ...zero, information: 1, redundancy: 1 }, { budget: 1 });
        expect(a.text.match(/alpha beta/g)).toHaveLength(2);
        expect(b.text.match(/alpha beta/g)).toHaveLength(1);
        expect(b.text).toContain('gamma delta');
    });
    for (const [key, signal] of [['instruction', 'could you help?'], ['entity', 'orchards near Kyoto thrive.'], ['structure', 'context: orchard irrigation.']] as const) {
        it(`${key} independently affects an eligible competitor`, async () => {
            const text = `ordinary background.\n${signal}`;
            const chunks = originalChunks(text, []);
            expect(chunks.every(c => !c.hardProtected)).toBe(true);
            const patch = { budget: .7, taskFocus: { policy: 'user' as const, chunkId: chunkId(chunks[0]) } };
            const before = await compress(text, { ...zero, relevance: .1 }, patch);
            const after = await compress(text, { ...zero, relevance: .1, [key]: 1 }, patch);
            expect(before.text.trim()).toBe('ordinary background.');
            expect(after.text.trim()).toBe(signal);
            expect(protectionRetention(text, after.text).total).toBe(0);
        });
    }
});
