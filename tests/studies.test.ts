import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { DEFAULTS, type Run, type Settings, type StudyKind } from '../src/engine/types.js';
import { assertStudyControls, compareDecisions, decisionAgreement, LADDER_BUDGETS, runStudy, studyObservations, studyPlan, targetTokens } from '../src/engine/studies.js';
import { runExperiment } from '../src/engine/runner.js';
import { transformScores } from '../src/engine/transforms.js';
import { exportCsv, exportData } from '../src/engine/export.js';
import { getTokenizer } from '../src/tokenizer/index.js';
import { chunkId, originalChunks } from '../src/engine/taskFocus.js';
import { EXAMPLES } from '../src/examples.js';

const teaching = EXAMPLES.find(e => e.id === 'math-study')!.text;
const settings = (patch: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULTS), ...patch });
const study = (kind: StudyKind, draft = settings(), text = teaching) => runStudy(text, kind, draft, runExperiment, () => {});

describe('controlled studies with the actual BPE runner', () => {
    for (const encoding of ['o200k_base', 'cl100k_base', 'r50k_base'] as const) it(`all seven vary only transform, ${encoding}`, async () => {
        const draft = settings({ encoding, weights: { ...DEFAULTS.weights, relevance: .8 }, protectedTerms: ['aging seal'], budget: .7,
            taskFocus: { policy: 'user', chunkId: chunkId(originalChunks(teaching, [])[0]) } });
        const runs = await study('transforms', draft);
        expect(runs).toHaveLength(7);
        const tokenizer = await getTokenizer(encoding);
        const plan = studyPlan('transforms', draft);
        runs.forEach((r, i) => {
            expect(r.original).toBe(teaching);
            expect(r.settings).toEqual(plan[i]);
            expect(r.taskFocus).toEqual(runs[0].taskFocus);
            expect(r.taskFocus.policy).toBe('user');
            expect(r.taskFocus.fallback).toBe('none');
            expect(r.inputHash).toBe(runs[0].inputHash);
            expect(r.taskFocus.textHash).toMatch(/^[a-f0-9]{64}$/);
            expect(r.decisions.map(d => d.originalScore)).toEqual(runs[0].decisions.map(d => d.originalScore));
            expect(r.decisions.map(d => d.scoring)).toEqual(runs[0].decisions.map(d => d.scoring));
            expect(r.decisions.every(d => JSON.stringify(d.scoring?.weights) === JSON.stringify(draft.weights))).toBe(true);
            expect(r.metrics.originalTokens).toBe(tokenizer.count(teaching));
            expect(r.metrics.compressedTokens).toBe(tokenizer.count(r.compressed));
            expect(r.metrics.protectionRate).toBe(1);
            expect(r.study).toEqual({ id: runs[0].study!.id, index: i, total: 7, kind: 'transforms', variable: 'transform' });
            expect(r.similarity).toBeNull();
        });
        expect(() => assertStudyControls(runs, 'transforms')).not.toThrow();
    });
    it('captures nested controls before awaiting and never chains ladder outputs', async () => {
        const draft = settings({ cutoff: 0, transform: 'sqrt' });
        const expected = structuredClone(draft), pending = study('ladder', draft);
        draft.encoding = 'r50k_base'; draft.weights.relevance = 0; draft.protectedTerms.push('all changed'); draft.taskFocus.policy = 'legacy';
        const runs = await pending;
        expect(runs.map(r => r.settings.budget)).toEqual(LADDER_BUDGETS);
        for (const r of runs) {
            expect(r.settings).toEqual({ ...expected, budget: r.settings.budget });
            const independent = await runExperiment(teaching, ['hybrid'], { ...expected, budget: r.settings.budget }, () => {});
            expect(r.outputHash).toBe(independent.outputHash);
            expect(r.decisions).toEqual(independent.decisions);
            expect(r.original).toBe(teaching);
            expect(r.budgetMet).toBe(r.metrics.compressedTokens <= targetTokens(r));
        }
        expect(runs.some(r => r.metrics.rate !== r.settings.budget)).toBe(true);
        expect(new Set(runs.map(r => r.outputHash)).size).toBeGreaterThan(1);
    });
    it('protected-only ladder reports actual retention, never the requested percentage', async () => {
        const runs = await study('ladder', settings(), 'Do NOT delete the database.');
        for (const r of runs) { expect(r.budgetMet).toBe(false); expect(r.metrics.rate).toBe(1); expect(r.compressed).toBe(r.original); }
        expect(studyObservations(runs).join(' ')).toContain('Budget unmet for 90% target, 70% target, 50% target, 30% target');
    });
    it('rejects changed raw features, controls, focus, original and incomplete evidence', async () => {
        const runs = await study('sigmoid-softmax');
        const mutations: ((r: Run) => void)[] = [r => { r.original += ' changed'; }, r => { r.inputHash = 'wrong'; },
            r => { r.settings.budget = .3; }, r => { r.settings.encoding = 'r50k_base'; },
            r => { r.settings.weights.relevance = 0; }, r => { r.settings.protectedTerms.push('extra'); },
            r => { r.taskFocus.textHash = 'wrong'; }, r => { r.decisions[0].originalScore += .01; },
            r => { r.decisions[0].scoring!.features.information = 0; }, r => { r.decisions = []; }];
        for (const mutate of mutations) {
            const changed = structuredClone(runs); mutate(changed[1]);
            expect(() => assertStudyControls(changed, 'sigmoid-softmax')).toThrow(/controls/);
        }
        expect(() => assertStudyControls(runs.slice(0, 1), 'sigmoid-softmax')).toThrow('incomplete');
        expect(() => assertStudyControls([], 'sigmoid-softmax')).toThrow('completed');
    });
    it('isolates successive studies, including changed weights and focus', async () => {
        const a = await study('sigmoid-softmax');
        await study('ladder', settings({ weights: { ...DEFAULTS.weights, information: 0 }, taskFocus: { policy: 'legacy', chunkId: null } }), 'other context.\nReturn only a summary.');
        const b = await study('sigmoid-softmax');
        expect(b.map(r => r.outputHash)).toEqual(a.map(r => r.outputHash));
        expect(b.map(r => r.decisions)).toEqual(a.map(r => r.decisions));
        expect(b[0].study!.id).not.toBe(a[0].study!.id);
    });
    it('empty prompt has explicit empty decisions and undefined ratios', async () => {
        const runs = await study('sigmoid-softmax', settings(), '');
        expect(compareDecisions(runs[0], runs[1])).toEqual([]);
        expect(runs.every(r => r.metrics.rate === null && r.similarity === null)).toBe(true);
    });
    it('default export retains study provenance but no prompt or custom protected text', async () => {
        const runs = await study('sigmoid-softmax', settings({ protectedTerms: ['private custom phrase'] }));
        const data = exportData(runs, false);
        expect(data.experiments.map(r => r.study)).toEqual(runs.map(r => r.study));
        const json = JSON.stringify(data);
        expect(json).not.toContain('private custom phrase');
        expect(json).not.toContain('Write a repair recommendation');
        expect(json).not.toContain('"text":');
        expect(exportData(runs, true).experiments[0]).toEqual(runs[0]);
        expect(exportCsv(runs)).toContain(runs[0].study!.id);
    });
});

describe('independent sigmoid and set-wide softmax', () => {
    it('sigmoid steepness separates both sides of its center', () => {
        const x = [.2, .5, .8], gentle = transformScores(x, settings({ transform: 'sigmoid', steepness: 1 }));
        const steep = transformScores(x, settings({ transform: 'sigmoid', steepness: 20 }));
        expect(steep[0]).toBeLessThan(gentle[0]); expect(steep[1]).toBe(.5); expect(steep[2]).toBeGreaterThan(gentle[2]);
        expect(transformScores([.2], settings({ transform: 'sigmoid', steepness: 20 }))[0]).toBe(steep[0]);
    });
    it('raising sigmoid center lowers values; extreme finite steepness remains in range', () => {
        const a = transformScores([.2, .5, .8], settings({ transform: 'sigmoid', center: .3 }));
        const b = transformScores([.2, .5, .8], settings({ transform: 'sigmoid', center: .7 }));
        expect(b.every((v, i) => v < a[i])).toBe(true);
        const extreme = transformScores([0, .5, 1], settings({ transform: 'sigmoid', steepness: Number.MAX_VALUE }));
        expect(extreme).toEqual([0, .5, 1]);
        expect(extreme.every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    });
    it('softmax normalizes, concentrates at low T, flattens at high T and depends on competitors', () => {
        const x = [.2, .4, .6, .8];
        const cold = transformScores(x, settings({ transform: 'softmax', temperature: .05 }));
        const warm = transformScores(x, settings({ transform: 'softmax', temperature: 2 }));
        for (const s of [cold, warm]) expect(s.reduce((a,b) => a+b, 0)).toBeCloseTo(1, 14);
        expect(cold[3]).toBeGreaterThan(warm[3]); expect(cold[0]).toBeLessThan(warm[0]);
        expect(warm.every(v => Math.abs(v - .25) < .04)).toBe(true);
        expect(transformScores([.8], settings({ transform: 'softmax' }))).toEqual([1]);
        expect(transformScores([.8, .8], settings({ transform: 'softmax' }))).toEqual([.5, .5]);
    });
    it('stable maximum subtraction handles extreme temperature, ties and empty sets', () => {
        const s = settings({ transform: 'softmax', temperature: Number.MIN_VALUE });
        expect(transformScores([0, 1, 1], s)).toEqual([0, .5, .5]);
        expect(transformScores([1, 1, 1], s)).toEqual([1/3, 1/3, 1/3]);
        expect(transformScores([], s)).toEqual([]);
    });
});

it('the four decision combinations have explicit labels', () => {
    expect([decisionAgreement(true,true), decisionAgreement(true,false), decisionAgreement(false,true), decisionAgreement(false,false)])
        .toEqual(['Same decision', 'Sigmoid only', 'Softmax only', 'Removed by both']);
});
it('observations describe actual selections, counts and missing measurements without a winner', async () => {
    const runs = await study('sigmoid-softmax', settings(), 'Do NOT delete the database.');
    const text = studyObservations(runs).join(' ');
    expect(text).toContain('selected the same chunks and produced identical text');
    expect(text).toContain(`Softmax retained ${runs[1].decisions.length} chunks; Sigmoid retained ${runs[0].decisions.length}`);
    expect(text).toContain('0 chunk decisions differed');
    expect(text).toContain('local embeddings were disabled');
    expect(text).not.toMatch(/better|optimized|optimal|winner|correct answer|lower.temperature/i);
    runs.forEach(r => { r.settings.useEmbeddings = true; r.similarityError = 'Injected missing measurement'; });
    expect(studyObservations(runs).join(' ')).toContain('Similarity is missing');
    expect(studyObservations([])).toEqual([]);
});
it('records actual teaching-example calculations for the research note', async () => {
    const transforms = await study('transforms'), ladder = await study('ladder');
    expect(new Set(transforms[0].decisions.map(d => d.originalScore)).size).toBeGreaterThan(3);
    const sample = [.2, .4, .6, .8];
    const example = { sample, sigmoid: transformScores(sample, settings({ transform: 'sigmoid' })),
        softmaxT1: transformScores(sample, settings({ transform: 'softmax', temperature: 1 })),
        softmaxT025: transformScores(sample, settings({ transform: 'softmax', temperature: .25 })) };
    await mkdir('.cache', { recursive: true });
    await writeFile('.cache/phase3-engine.json', JSON.stringify({ example, transforms: exportData(transforms, true), ladder: exportData(ladder, true) }, null, 2));
});
