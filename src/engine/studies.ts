import type { Decision, Method, Run, Settings, StudyKind } from './types.js';
import { validateSettings } from './settings.js';
import { TRANSFORMS } from './transforms.js';

export const LADDER_BUDGETS = [.9, .7, .5, .3] as const;
export const STUDY_TITLES: Record<StudyKind, string> = {
    transforms: 'Why math matters', 'sigmoid-softmax': 'Sigmoid vs Softmax', ladder: 'Compression vs preservation',
};
export function studyPlan(kind: StudyKind, settings: Settings): Settings[] {
    const snapshot = structuredClone(settings);
    validateSettings(snapshot);
    switch (kind) {
        case 'transforms': return TRANSFORMS.map(t => ({ ...structuredClone(snapshot), transform: t.id }));
        case 'sigmoid-softmax': return (['sigmoid', 'softmax'] as const).map(transform => ({ ...structuredClone(snapshot), transform }));
        case 'ladder': return LADDER_BUDGETS.map(budget => ({ ...structuredClone(snapshot), budget }));
        default: throw new Error('Unknown study.');
    }
}
// Decisions cleared by the final guard cannot support a controlled chunk comparison.
const rawEvidence = (run: Run) => run.decisions.map(d => ({ index: d.index, text: d.text,
    originalScore: d.originalScore, tokens: d.tokens, hardProtected: d.hardProtected,
    hardProtectionReasons: d.hardProtectionReasons, scoring: d.scoring }));
export function assertStudyControls(runs: Run[], kind: StudyKind): void {
    if (!runs.length) throw new Error('A study needs completed runs.');
    const first = runs[0], plan = studyPlan(kind, first.settings);
    if (runs.length !== plan.length) throw new Error('Study incomplete; all planned runs are required.');
    for (const [i, run] of runs.entries()) {
        if (run.original !== first.original || run.inputHash !== first.inputHash || run.engineVersion !== first.engineVersion ||
            JSON.stringify(run.taskFocus) !== JSON.stringify(first.taskFocus) ||
            JSON.stringify(run.settings) !== JSON.stringify(plan[i]) ||
            JSON.stringify(run.methods) !== JSON.stringify(['hybrid']) ||
            (run.original.length > 0 && !run.decisions.length) ||
            JSON.stringify(rawEvidence(run)) !== JSON.stringify(rawEvidence(first)))
            throw new Error('Study controls differ or chunk decisions are unavailable. Comparison was not recorded.');
    }
}
type Execute = (original: string, methods: Method[], settings: Settings, progress: (message: string) => void) => Promise<Run>;
/** Uses the normal runner in the worker. No separate scoring, token counting or model path. */
export async function runStudy(original: string, kind: StudyKind, settings: Settings, execute: Execute, progress: (message: string) => void): Promise<Run[]> {
    const plan = studyPlan(kind, settings), id = crypto.randomUUID(), runs: Run[] = [];
    for (const [index, snapshot] of plan.entries()) {
        const label = `${STUDY_TITLES[kind]} ${index + 1}/${plan.length}`;
        const run = await execute(original, ['hybrid'], snapshot, message => progress(`${label} · ${message}`));
        runs.push({ ...run, study: { id, kind, variable: kind === 'ladder' ? 'budget' : 'transform', index, total: plan.length } });
    }
    assertStudyControls(runs, kind);
    return runs;
}
export type DecisionAgreement = 'Same decision' | 'Sigmoid only' | 'Softmax only' | 'Removed by both';
export const decisionAgreement = (sigmoid: boolean, softmax: boolean): DecisionAgreement =>
    sigmoid ? softmax ? 'Same decision' : 'Sigmoid only' : softmax ? 'Softmax only' : 'Removed by both';
export function compareDecisions(sigmoid: Run, softmax: Run): { sigmoid: Decision; softmax: Decision; agreement: DecisionAgreement }[] {
    assertStudyControls([sigmoid, softmax], 'sigmoid-softmax');
    return sigmoid.decisions.map((d, i) => ({ sigmoid: d, softmax: softmax.decisions[i], agreement: decisionAgreement(d.kept, softmax.decisions[i].kept) }));
}
export const chunkCounts = (r: Run) => ({ kept: r.decisions.filter(d => d.kept).length, removed: r.decisions.filter(d => !d.kept).length });
export const targetTokens = (r: Run) => Math.floor(r.metrics.originalTokens * r.settings.budget);
export const runLabel = (r: Run) => r.study?.kind === 'ladder' ? `${Math.round(r.settings.budget * 100)}% target` : TRANSFORMS.find(t => t.id === r.settings.transform)!.label;
/** Descriptive observations only. No winner, inferred correctness or unexplored temperature effect. */
export function studyObservations(runs: Run[]): string[] {
    if (!runs.length) return [];
    const observations: string[] = [];
    const selections = new Map<string, Run[]>();
    for (const r of runs) {
        const key = JSON.stringify(r.decisions.map(d => [d.index, d.kept]));
        selections.set(key, [...(selections.get(key) ?? []), r]);
    }
    for (const group of selections.values()) if (group.length > 1)
        observations.push(`${group.map(runLabel).join(', ')} selected the same chunks${new Set(group.map(r => r.outputHash)).size === 1 ? ' and produced identical text' : ''}.`);
    const sigmoid = runs.find(r => r.settings.transform === 'sigmoid'), softmax = runs.find(r => r.settings.transform === 'softmax');
    if (sigmoid && softmax) observations.push(`Softmax retained ${chunkCounts(softmax).kept} chunks; Sigmoid retained ${chunkCounts(sigmoid).kept}. ${compareDecisions(sigmoid, softmax).filter(row => row.sigmoid.kept !== row.softmax.kept).length} chunk decisions differed.`);
    const unmet = runs.filter(r => r.budgetMet === false);
    if (unmet.length) observations.push(`Budget unmet for ${unmet.map(runLabel).join(', ')}. Actual counts exceed their targets; protected constraints were preserved. Inspect each result for the recorded reason.`);
    const measured = runs.filter(r => r.similarity).length;
    observations.push(measured ? `Similarity was measured for ${measured}/${runs.length} runs. Embedding cosine is a diagnostic proxy, not task correctness.` :
        runs.every(r => !r.settings.useEmbeddings) ? 'Similarity was not measured because local embeddings were disabled.' : 'Similarity is missing for these runs. Inspect the recorded model errors or empty-text explanation.');
    return observations;
}
