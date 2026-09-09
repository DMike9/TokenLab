import type { Decision, TaskFocus, Weights } from '../engine/types.js';
const labels: Record<keyof Weights, string> = { relevance: 'Relevance', information: 'Information', instruction: 'Instruction signal', entity: 'Entity signal', structure: 'Structure signal', redundancy: 'Redundancy' };
export function ScoreDetails({ decision, focus }: { decision: Decision; focus: TaskFocus }) {
    const s = decision.scoring;
    if (!s) return null;
    return <details className="score-details"><summary>Soft importance components</summary>
        <p>Experimental heuristic — not a learned importance probability.</p>
        {s.relevanceMetric === 'missing-empty-text' && <p className="fineprint">Relevance unavailable for an empty focus or whitespace-only chunk. Its relevance contribution is zero by convention; no embedding measurement is claimed.</p>}
        <p className="fineprint">Relevance: {s.relevanceMetric} against original task-focus chunk {focus.chunkIndex == null ? 'unavailable' : focus.chunkIndex + 1} ({focus.policy}). {decision.hardProtected ? 'Hard protection bypasses deletion regardless of this score.' : 'Eligible content competes for the budget.'}</p>
        {s.embeddingModel && <p className="fineprint">{s.embeddingModel.model} · {s.embeddingModel.dtype} · revision {s.embeddingModel.revision}</p>}
        <div className="table-scroll"><table><thead><tr><th>Feature</th><th>Value</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>
            {(Object.keys(labels) as (keyof Weights)[]).map(k => <tr key={k}><th>{labels[k]}</th><td>{s.features[k].toFixed(3)}</td><td>{s.weights[k].toFixed(2)}</td><td>{s.contributions[k].toFixed(3)}</td></tr>)}
        </tbody></table></div>
        <p className="fineprint">Positive contribution = value × weight / positive weight sum ({s.positiveWeightSum.toFixed(2)}); zero sum gives zero positive terms. Redundancy contribution = −value × weight. Display rounded; exports retain computed values.</p>
        <p className="fineprint">Raw sum {s.rawScore.toFixed(3)} → clipped [0,1] {decision.originalScore.toFixed(3)} → shaped {decision.transformedScore.toFixed(3)}. Raising one positive weight rescales the others; redundancy is outside that normalization.</p>
    </details>;
}
