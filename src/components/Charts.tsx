import { useMemo } from 'react';
import type { Run, Settings } from '../engine/types.js';
import { transformScores, TRANSFORMS } from '../engine/transforms.js';
import { paretoFrontier } from '../engine/metrics.js';
export function TransformChart({ settings }: {
    settings: Settings;
}) {
    const scores = Array.from({ length: 41 }, (_, i) => i / 40);
    const shaped = transformScores(scores, settings);
    const isSoftmax = settings.transform === 'softmax';
    const max = isSoftmax ? Math.max(...shaped) : 1;
    const path = shaped.map((v, i) => `${i ? 'L' : 'M'}${28 + i / 40 * 250},${150 - v / max * 120}`).join(' ');
    const def = TRANSFORMS.find(t => t.id === settings.transform)!;
    return <div className="transform-chart"><div className="chart-caption"><span>IMPORTANCE TRANSFER</span><code>{def.formula}</code></div>
  <svg viewBox="0 0 310 181" role="img" aria-label={`${def.label} transform of importance scores`}>
   {[0, .5, 1].map(n => <g key={n}><line className="grid-line" x1="28" x2="278" y1={150 - n * 120} y2={150 - n * 120}/><text className="axis-label" x="4" y={154 - n * 120}>{(n * max).toFixed(isSoftmax ? 2 : 1)}</text></g>)}
   <path d="M28 30V150H278" className="axis-line"/>
   {!isSoftmax && <path d="M28 150L278 30" className="diagonal"/>}
   <path d={path} className="curve"/>
   <text className="axis-label" x="28" y="172">0</text><text className="axis-label" x="255" y="172">1.0 x</text>
  </svg>
  <p>{def.explanation} {isSoftmax && 'Illustration uses 41 evenly spaced scores; actual shares depend on all prompt chunks.'}</p>
 </div>;
}
export function ParetoChart({ runs, selected, onSelect }: {
    runs: Run[];
    selected?: string;
    onSelect: (id: string) => void;
}) {
    const points = useMemo(() => runs.filter(r => r.similarity).map(r => ({ id: r.id, tokens: r.metrics.compressedTokens, similarity: r.similarity!.cosine })), [runs]);
    const frontier = paretoFrontier(points), maxTokens = Math.max(1, ...runs.map(r => r.metrics.originalTokens));
    const yMin = points.some(p => p.similarity < 0) ? -1 : 0;
    const x = (v: number) => 50 + v / maxTokens * 520;
    const y = (v: number) => 210 - (v - yMin) / (1 - yMin) * 180;
    const line = points.filter(p => frontier.has(p.id)).sort((a, b) => a.tokens - b.tokens).map((p, i) => `${i ? 'L' : 'M'}${x(p.tokens)},${y(p.similarity)}`).join(' ');
    return <div className="pareto"><div className="section-heading compact"><div><span className="eyebrow">THE TRADEOFF</span><h3>Less text. What survives?</h3></div><span className="badge">{points.length} measured points</span></div>
  {points.length ? <svg viewBox="0 0 610 250" role="img" aria-label="Observed token-count versus embedding-similarity Pareto frontier">
   {[0, .25, .5, .75, 1].map(v => <g key={v}><line className="grid-line" x1="50" x2="570" y1={y(v)} y2={y(v)}/><text className="axis-label" x="13" y={y(v) + 4}>{v.toFixed(2)}</text></g>)}
   <path d="M50 30V210H570" className="axis-line"/><path d={line} className="frontier-line"/>
   {points.map(p => <g key={p.id} role="button" tabIndex={0} aria-label={`Select experiment: ${p.tokens} tokens, similarity ${p.similarity.toFixed(4)}`} onClick={() => onSelect(p.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(p.id);
            } }}>
    <circle cx={x(p.tokens)} cy={y(p.similarity)} r={p.id === selected ? 8 : 5} className={frontier.has(p.id) ? 'pareto-point efficient' : 'pareto-point'}><title>{runs.find(r => r.id === p.id)?.methods.join(' → ')} · {p.tokens} tokens · cosine {p.similarity.toFixed(4)}</title></circle>
   </g>)}
   <text className="axis-label" x="50" y="233">0</text><text className="axis-label" x="480" y="233">{maxTokens} tokens retained</text>
   <text className="axis-label" x="51" y="17">Embedding cosine · higher is better only as a proxy</text>
  </svg> : <div className="chart-empty"><div className="empty-axis"><span>SEMANTIC SIMILARITY ↑</span><i /><span>← FEWER TOKENS</span></div><p>Enable local embeddings and run a few methods to reveal the measured frontier.</p><small>No model loaded means no invented similarity points.</small></div>}
  <p className="fineprint">Observed frontier, not an optimality claim. Compare only the same prompt, encoding and embedding model revision. A high dot does not prove a correct answer.</p>
 </div>;
}
