import type { Method, Run, Settings } from '../engine/types.js';
import { DEFAULTS } from '../engine/types.js';
import { getStrategy } from '../engine/strategies.js';
import { protectedSpans } from '../engine/protection.js';

export function settingsChanged(run: Run, settings: Settings, methods: Method[]): boolean {
    // Compare every draft control conservatively, including controls unused by the current method.
    return JSON.stringify(run.methods) !== JSON.stringify(methods) ||
        (Object.keys(DEFAULTS) as (keyof Settings)[]).some(key => JSON.stringify(run.settings[key]) !== JSON.stringify(settings[key]));
}

export function ResultContext({ run, changed }: { run: Run; changed: boolean }) {
    const budget = run.methods.some(m => ['importance', 'hybrid', 'similarity'].includes(m));
    const shaped = run.methods.some(m => ['importance', 'hybrid'].includes(m));
    const json = run.metrics.savedTokens === 0 && protectedSpans(run.original).some(s => s.reason === 'JSON document');
    return <>
        <div className="result-context" aria-label="Recorded result settings">
            <strong>Recorded result</strong><p className="fineprint">These settings produced the result below. Editing controls does not recalculate it.</p>
            <dl>
                <div><dt>Method / chain</dt><dd>{run.methods.map(m => getStrategy(m).name).join(' → ')}</dd></div>
                <div><dt>Tokenizer</dt><dd>{run.settings.encoding}</dd></div>
                <div><dt>Token budget</dt><dd>{budget ? `${(run.settings.budget * 100).toFixed(0)}% retained${run.stages.length > 1 ? ' of each budgeted stage’s input' : ''}` : 'Not applied by this method'}</dd></div>
                <div><dt>Transform</dt><dd>{run.settings.transform}{!shaped && ' (not applied)'}</dd></div>
                <div><dt>Score cutoff</dt><dd>{shaped ? `${run.settings.cutoff}${run.settings.transform === 'softmax' ? ' / chunk count (softmax share)' : ''}` : 'Not applied'}</dd></div>
                <div><dt>Semantic floor</dt><dd>{run.methods.includes('similarity') ? `${run.settings.semanticFloor} cosine` : 'Not applied'}</dd></div>
                <div><dt>Embedding model</dt><dd>{run.similarity ? `${run.similarity.model} · ${run.similarity.dtype} · revision ${run.similarity.revision}` : 'Not measured for this run'}</dd></div>
            </dl>
            {run.stages.length > 1 && <p className="fineprint">Each budgeted stage uses its own input. The budget status below describes the final stage; total savings compare with the original prompt.</p>}
            <details><summary>All recorded settings</summary><pre>{JSON.stringify(run.settings, null, 2)}</pre></details>
        </div>
        {changed && <p className="notice settings-changed" role="status">Settings changed — run again to update the result.</p>}
        {run.metrics.savedTokens === 0 && <p className="notice result-explanation">{run.methods.every(m => m === 'baseline') ? 'Zero savings is expected: Baseline keeps the original text for comparison.' : json ? 'Zero savings: valid JSON is protected verbatim. Structural field removal is not supported by these methods.' : 'Zero savings: this method found no token reduction within its rules and protection constraints. An unchanged result is a valid observation.'}</p>}
        {run.budgetMet === false && <p className="notice result-explanation">{run.stages.at(-1)?.method === 'similarity' ? 'Target budget not met: protected chunks and/or the semantic floor prevented further deletion.' : 'Target budget not met: detected protected chunks exceed the target. Protection takes priority; increase the retained budget to allow more text.'} This is a constraint outcome, not an application failure.</p>}
    </>;
}
