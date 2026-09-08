import { useMemo, useState } from 'react';
import type { Method, Run, Settings, Transform, Weights } from './engine/types.js';
import { DEFAULTS, MAX_CHARACTERS } from './engine/types.js';
import { STRATEGIES, getStrategy } from './engine/strategies.js';
import { TRANSFORMS } from './engine/transforms.js';
import { diffText } from './engine/diff.js';
import { mergedSpans, protectedSpans } from './engine/protection.js';
import { exportCsv, exportData } from './engine/export.js';
import { EXAMPLES } from './examples.js';
import { useLab } from './hooks/useLab.js';
import type { Analysis } from './hooks/useLab.js';
import { ParetoChart, TransformChart } from './components/Charts.js';
import { TokenInspector } from './components/TokenInspector.js';
import { GeminiArena } from './components/GeminiArena.js';
const number = (v: number | null | undefined, digits = 0) => v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: digits });
const percent = (v: number | null | undefined) => v == null ? '—' : `${(v * 100).toFixed(1)}%`;
function protectedText(text: string, terms: string[]) {
    const spans = mergedSpans(protectedSpans(text, terms));
    let at = 0;
    const pieces: {
        text: string;
        protected: boolean;
    }[] = [];
    for (const s of spans) {
        if (s.start > at)
            pieces.push({ text: text.slice(at, s.start), protected: false });
        pieces.push({ text: text.slice(s.start, s.end), protected: true });
        at = s.end;
    }
    if (at < text.length)
        pieces.push({ text: text.slice(at), protected: false });
    return pieces.map((p, i) => p.protected ? <mark className="protected-text" key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>);
}
function Slider({ label, value, min = 0, max = 1, step = .01, onChange, format = v => v.toFixed(2) }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
    format?: (value: number) => string;
}) {
    return <label className="slider"><span>{label}<output>{format(value)}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></label>;
}
export default function App() {
    const lab = useLab();
    const [input, setInput] = useState(EXAMPLES[0].text), [exampleId, setExampleId] = useState(EXAMPLES[0].id);
    const [settings, setSettings] = useState<Settings>({ ...DEFAULTS, weights: { ...DEFAULTS.weights }, protectedTerms: [] });
    const [analysis, setAnalysis] = useState<Analysis | null>(null), [runs, setRuns] = useState<Run[]>([]), [selectedId, setSelectedId] = useState('');
    const [method, setMethod] = useState<Method>('importance'), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [chainMode, setChainMode] = useState(false), [chain, setChain] = useState<Method[]>(['minify', 'deduplicate', 'lexical', 'importance']);
    const [tab, setTab] = useState<'diff' | 'side' | 'scores' | 'tokens'>('diff'), [includeText, setIncludeText] = useState(false);
    const [customProtection, setCustomProtection] = useState(''), [status, setStatus] = useState(''), [copied, setCopied] = useState(false);
    const activeAnalysis = analysis?.input === input && analysis.encoding === settings.encoding ? analysis : null;
    const matchingRuns = runs.filter(r => r.original === input && r.settings.encoding === settings.encoding);
    const selected = matchingRuns.find(r => r.id === selectedId) ?? matchingRuns.at(-1);
    const chartRuns = matchingRuns.filter(r => !selected?.similarity || !r.similarity || (r.similarity.model === selected.similarity.model && r.similarity.revision === selected.similarity.revision && r.similarity.dtype === selected.similarity.dtype));
    const diff = useMemo(() => selected ? diffText(selected.original, selected.compressed) : null, [selected]);
    const example = EXAMPLES.find(e => e.id === exampleId);
    const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
    const withProtection = (s: Settings): Settings => ({ ...s, protectedTerms: customProtection.split('\n').filter(t => t.trim()), weights: { ...s.weights } });
    const analyze = async () => {
        setBusy(true);
        setError('');
        setStatus('');
        try {
            setAnalysis(await lab.analyze(input, withProtection(settings)));
            setStatus('Original prompt analyzed. Choose an experiment below.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    };
    const run = async (chosen: Method = method, override: Partial<Settings> = {}, multiple?: Method[]) => {
        setBusy(true);
        setError('');
        setStatus('');
        setMethod(chosen);
        setCopied(false);
        const snapshot = withProtection({ ...settings, ...override });
        try {
            if (!activeAnalysis)
                setAnalysis(await lab.analyze(input, snapshot));
            const result = await lab.run(input, multiple ?? (chainMode ? chain : [chosen]), snapshot);
            setRuns(old => [...old, result].slice(-100));
            setSelectedId(result.id);
            setTab(result.decisions.length ? 'scores' : 'diff');
            setStatus(`${result.methods.map(m => getStrategy(m).name).join(' → ')} complete. ${result.metrics.savedTokens} tokens saved.`);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    };
    const sweep = async () => {
        setBusy(true);
        setError('');
        setStatus('');
        const snapshot = withProtection(settings);
        try {
            if (!activeAnalysis)
                setAnalysis(await lab.analyze(input, snapshot));
            const completed: Run[] = [];
            for (const transform of TRANSFORMS) {
                const r = await lab.run(input, ['importance'], { ...snapshot, transform: transform.id });
                completed.push(r);
                setRuns(old => [...old, r].slice(-100));
                setSelectedId(r.id);
            }
            setTab('scores');
            setStatus(`Completed ${completed.length} transforms against the same original prompt and settings.`);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    };
    const enable = async () => {
        setBusy(true);
        setError('');
        try {
            await lab.enable(settings);
            update('useEmbeddings', true);
            setStatus('Local embeddings ready. New runs will include measured similarity.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            update('useEmbeddings', false);
        }
        finally {
            setBusy(false);
        }
    };
    const download = (content: string, filename: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };
    const clear = () => {
        lab.stop();
        setBusy(false);
        setRuns([]);
        setAnalysis(null);
        setInput('');
        setExampleId('');
        setSelectedId('');
        setError('');
        setCustomProtection('');
        setSettings({ ...DEFAULTS, weights: { ...DEFAULTS.weights }, protectedTerms: [] });
        setStatus('Prompt, run history and worker memory cleared. Public model downloads may remain in browser cache.');
    };
    const applyTransform = (transform: Transform) => { update('transform', transform); setChainMode(false); void run('importance', { transform }, ['importance']); };
    return <><a className="skip-link" href="#prompt">Skip to prompt</a><header className="topbar"><a className="wordmark" href="#"><span className="logo">T<span>·</span></span>TokenLab<span className="version">0.1 / EXPERIMENTAL</span></a><div className="row"><span className="privacy"><i />LOCAL-FIRST</span><a className="quiet" href="#research">Research notes ↗</a></div></header>
 <main><section className="hero"><div className="hero-copy"><span className="eyebrow">PROMPT COMPRESSION / AN OPEN RESEARCH PLAYGROUND</span><h1>Less text.<br /><span>What survives?</span></h1><p>One prompt. Different experiments. Find the point where removing words starts removing what matters.</p></div><div className="hero-diagram" aria-hidden="true"><div className="token-stream"><i>context</i><i className="dim">really</i><i>NOT</i><i className="dim">very</i><i>42</i><i>return</i><i className="dim">again</i></div><div className="stream-axis">──────────  f(x)  ──────────➜</div><div className="token-stream result-stream"><i>context</i><i className="protected">NOT</i><i className="protected">42</i><i>return</i></div><small>Illustration only · your measurements appear below</small></div></section>
 <section className="panel input-panel" id="prompt"><div className="section-heading"><div><span className="eyebrow">01 / THE CONTROL</span><h2>Original prompt</h2></div><select aria-label="Load example" value={exampleId} disabled={busy} onChange={e => { const ex = EXAMPLES.find(x => x.id === e.target.value); if (ex) {
        setExampleId(ex.id);
        setInput(ex.text);
        setAnalysis(null);
        setStatus('');
        setCopied(false);
    } }}><option value="">Custom prompt</option>{EXAMPLES.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select></div>
 <textarea aria-label="Original prompt" className="prompt-input" value={input} disabled={busy} maxLength={MAX_CHARACTERS} spellCheck={false} onChange={e => { setInput(e.target.value); setExampleId(''); setCopied(false); }} placeholder="Paste a prompt. The local algorithms do not send it anywhere."/>
 <div className="input-footer"><div className="row"><button className="primary" onClick={analyze} disabled={busy}>Analyze prompt ↗</button><select aria-label="Tokenizer encoding" value={settings.encoding} disabled={busy} onChange={e => update('encoding', e.target.value as Settings['encoding'])}>{['o200k_base', 'cl100k_base', 'r50k_base'].map(x => <option key={x}>{x}</option>)}</select></div><span className="fineprint">{input.length.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} input code units · no prompt storage by default</span></div>
 <div className="input-metrics"><div><small>ORIGINAL TOKENS</small><strong>{number(activeAnalysis?.metrics.originalTokens)}</strong></div><div><small>WORDS</small><strong>{number(activeAnalysis?.metrics.originalWords)}</strong></div><div><small>CHARACTERS</small><strong>{number(activeAnalysis?.metrics.originalCharacters)}</strong></div><div><small>PROTECTED SPANS</small><strong className="purple">{number(activeAnalysis?.protection.length)}</strong></div></div>
 <p className="fineprint">Exact raw-text counts for the selected BPE encoding. Not a full chat-request bill, not a Gemini token count. {example && <span>{example.lesson}</span>}</p>
 </section>
 <div className="lab-layout"><aside className="control-column"><section className="panel controls"><div className="section-heading"><div><span className="eyebrow">02 / THE INSTRUMENT</span><h2>Compression lab</h2></div><span className="badge">{chainMode ? 'CHAIN' : 'INDEPENDENT'}</span></div>
 <p className="fineprint">Every independent run starts from the original prompt, not the last result.</p><div className="method-grid">{STRATEGIES.map(s => <button key={s.id} className={`method-card ${method === s.id ? 'active' : ''}`} disabled={busy || (s.id === 'similarity' && !settings.useEmbeddings)} onClick={() => { setChainMode(false); void run(s.id, {}, [s.id]); }}><span>{s.name}<b>↗</b></span><small>{s.description}</small>{s.warning && <em>DESTRUCTIVE EXPERIMENT</em>}</button>)}</div>
 <div className="control-section"><span className="eyebrow">TOKEN BUDGET</span><Slider label="Target retained" value={settings.budget} min={.1} max={1} step={.05} format={percent} onChange={v => update('budget', v)}/><p className="fineprint">Applies to importance, hybrid and similarity guard. Protected chunks may make a target infeasible.</p></div>
 <div className="control-section"><span className="eyebrow">MATHEMATICAL SHAPING</span><div className="transform-buttons">{TRANSFORMS.map(t => <button key={t.id} disabled={busy} title={t.explanation} aria-pressed={settings.transform === t.id} className={settings.transform === t.id ? 'active' : ''} onClick={() => applyTransform(t.id)}>{t.label}</button>)}</div>
 <TransformChart settings={settings}/><Slider label="Shaped-score cutoff" value={settings.cutoff} onChange={v => update('cutoff', v)}/>{settings.transform === 'softmax' && <Slider label="Temperature" min={.05} max={2} step={.05} value={settings.temperature} onChange={v => update('temperature', v)}/>}{settings.transform === 'sigmoid' && <><Slider label="Sigmoid steepness k" min={1} max={20} step={1} value={settings.steepness} onChange={v => update('steepness', v)} format={number}/><Slider label="Sigmoid center t" value={settings.center} onChange={v => update('center', v)}/></>}
 <button className="wide" disabled={busy || !input.trim()} onClick={sweep}>Run all 7 transforms against this prompt</button></div>
 <details className="control-section"><summary>Redundancy parameters</summary><Slider label="Sentence overlap threshold" min={.5} max={1} value={settings.redundancyThreshold} onChange={v => update('redundancyThreshold', v)}/><Slider label="N-gram size" min={1} max={5} step={1} value={settings.ngramSize} onChange={v => update('ngramSize', v)} format={number}/><Slider label="Minimum occurrences" min={2} max={5} step={1} value={settings.minimumRepetitions} onChange={v => update('minimumRepetitions', v)} format={number}/><p className="fineprint">Threshold 1 uses exact case-sensitive trimmed chunk text. Lower values use word n-gram Jaccard, not embedding similarity.</p></details>
 <details className="control-section"><summary>Experimental weighted objective</summary><p className="fineprint">Weighted positive features divided by their weight sum, minus redundancy weight × redundancy; clipped to [0,1]. A heuristic, not a learned or optimal objective.</p>{(Object.keys(settings.weights) as (keyof Weights)[]).map(key => <Slider key={key} label={key === 'relevance' ? `Relevance (${settings.useEmbeddings ? 'embedding' : 'lexical'})` : key} value={settings.weights[key]} onChange={value => update('weights', { ...settings.weights, [key]: value })}/>)}<p className="fineprint">These sliders apply to Weighted hybrid. Relevance is anchored to the last nonempty chunk; verify that it actually represents your task.</p><button disabled={busy} onClick={() => { setChainMode(false); void run('hybrid', {}, ['hybrid']); }}>Run weighted hybrid</button></details>
 <details className="control-section"><summary>Chain operations</summary><p className="fineprint">Each budget percentage applies to that stage’s input. Repeated budget stages can compound reductions; final metrics compare with the original.</p><label className="check"><input type="checkbox" checked={chainMode} disabled={busy} onChange={e => setChainMode(e.target.checked)}/> Use ordered pipeline on Run experiment</label><div className="chain-editor">{chain.map((m, i) => <div className="row" key={i}><span className="step-num">{i + 1}</span><select aria-label={`Pipeline stage ${i + 1}`} value={m} disabled={busy} onChange={e => setChain(old => old.map((x, j) => i === j ? e.target.value as Method : x))}>{STRATEGIES.filter(s => s.id !== 'baseline').map(s => <option key={s.id} value={s.id} disabled={s.id === 'similarity' && !settings.useEmbeddings}>{s.name}</option>)}</select><button className="small" aria-label={`Remove stage ${i + 1}`} disabled={busy || chain.length === 1} onClick={() => setChain(old => old.filter((_, j) => j !== i))}>×</button></div>)}</div><button disabled={busy || chain.length >= 8} onClick={() => setChain(old => [...old, 'importance'])}>+ Stage</button></details>
 <button className="primary wide run-button" disabled={busy || !input.trim()} onClick={() => void run()}>{busy ? 'Experiment running…' : `Run ${chainMode ? 'pipeline' : getStrategy(method).name} →`}</button>
 </section><section className="panel semantic-panel"><span className="eyebrow">LOCAL SEMANTIC MODEL</span><h3>Measure similarity.</h3><p>Optional browser inference with a quantized sentence-embedding model. First use downloads public model files; your prompt stays local.</p><button className={settings.useEmbeddings ? 'wide' : 'primary wide'} disabled={busy} onClick={() => settings.useEmbeddings ? update('useEmbeddings', false) : void enable()}>{settings.useEmbeddings ? '✓ Enabled · disable for new runs' : 'Download / enable local embeddings'}</button><Slider label="Semantic floor" min={.8} max={1} step={.01} value={settings.semanticFloor} onChange={v => update('semanticFloor', v)}/><p className="fineprint">Floor applies only to Similarity guard. Whole-document cosine averages model-token-aware chunks; it does not prove equivalent model behavior.</p></section></aside>
 <div className="results-column"><section className="panel results"><div className="section-heading"><div><span className="eyebrow">03 / THE OBSERVATION</span><h2>What changed?</h2></div><span className="badge">{selected ? selected.methods.map(m => getStrategy(m).name).join(' → ') : 'AWAITING EXPERIMENT'}</span></div>
 {selected ? <><div className="result-metrics"><div className="big-stat"><small>TOKEN SAVINGS</small><strong>{selected.metrics.savingsPercent.toFixed(1)}<span>%</span></strong><span>{number(selected.metrics.originalTokens)} → {number(selected.metrics.compressedTokens)} tokens</span></div><div><small>SEMANTIC COSINE</small><strong>{selected.similarity?.cosine.toFixed(4) ?? '—'}</strong><span>{selected.similarity ? 'Measured proxy, not proof' : 'Not measured'}</span></div><div><small>PROTECTED RETENTION</small><strong className="purple">{percent(selected.metrics.protectionRate)}</strong><span>{selected.metrics.protectedRetained}/{selected.metrics.protectedTotal} detected occurrences</span></div></div>
 <div className="retention-track" role="img" aria-label={`${percent(selected.metrics.rate)} of original tokens retained`}><span style={{ width: `${Math.min(100, Math.max(0, (selected.metrics.rate ?? 0) * 100))}%` }}/><i style={{ left: `${selected.settings.budget * 100}%` }}/></div><div className="row fineprint"><span>Retained {percent(selected.metrics.rate)} · factor {selected.metrics.factor?.toFixed(2) ?? 'undefined'}×</span><span>{selected.budgetMet == null ? 'Budget not applied by this method' : selected.budgetMet ? '✓ Within budget' : '⚠ Budget unmet; constraints preserved'}</span></div>
 {selected.methods.includes('stopwords') && <div className="notice warning">High token reduction does not necessarily mean information preservation. Function-word ablation can damage the task.</div>}
 {selected.similarityError && <div className="notice warning">Similarity unavailable: {selected.similarityError}</div>}
 <div className="tabs" role="tablist" aria-label="Result views">{([['diff', 'Visual diff'], ['side', 'Side by side'], ['scores', 'Why it survived'], ['tokens', 'Original tokens']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
 {tab === 'diff' && <><div className="legend"><span className="retained">Retained</span><span className="removed">Removed</span><span className="added">Rewritten / added</span></div><div className="diff-text">{diff?.parts.map((p, i) => <span key={i} className={`diff-${p.kind}`}>{p.text}</span>)}</div>{diff?.coarse && <p className="fineprint">Long-input fallback: the changed middle is shown as a coarse replacement instead of a word-level diff.</p>}</>}
 {tab === 'side' && <div className="side-grid"><div><span className="eyebrow">ORIGINAL · PROTECTED IN PURPLE</span><pre>{protectedText(selected.original, selected.settings.protectedTerms)}</pre></div><div><span className="eyebrow">COMPRESSED · PROTECTED IN PURPLE</span><pre>{protectedText(selected.compressed, selected.settings.protectedTerms)}</pre></div></div>}
 {tab === 'scores' && (selected.decisions.length ? <div className="score-list">{selected.decisions.map(d => <div className={`score-row ${d.kept ? 'kept' : 'discarded'} ${d.protected ? 'guarded' : ''}`} key={d.index}><div className="score-label"><span>{d.protected ? '◈ PROTECTED' : d.kept ? '✓ RETAINED' : '− REMOVED'}</span><code>{d.originalScore.toFixed(3)} → {d.transformedScore.toFixed(3)}</code></div><div className="score-meter"><span style={{ width: `${d.originalScore * 100}%` }}/><i style={{ width: `${Math.min(1, d.transformedScore) * 100}%` }}/></div><p>{d.text}</p><small>{d.reason} · {d.tokens} isolated-chunk tokens</small></div>)}</div> : <div className="empty-state"><h3>No salience scoring for this method.</h3><p>This deterministic operation changes explicit text patterns. Use Visual diff, or run Importance + math to inspect chunk scores.</p></div>)}
 {tab === 'tokens' && activeAnalysis && <TokenInspector key={selected.inputHash + settings.encoding} tokens={activeAnalysis.tokens} total={activeAnalysis.total}/>}
 <div className="result-footer"><span className="fineprint">{number(selected.metrics.removedCharacters)} characters removed · {number(selected.metrics.removedWords)} words removed · {selected.compressionMs.toFixed(1)} ms compression · {selected.totalMs.toFixed(1)} ms total</span><button className="small" onClick={async () => { try {
            await navigator.clipboard.writeText(selected.compressed);
            setCopied(true);
        }
        catch {
            setError('Clipboard unavailable. Select the compressed text in Side by side and copy it.');
        } }}>{copied ? 'Copied ✓' : 'Copy result'}</button></div>
 {selected.stages.length > 1 && <div className="pipeline-result"><span className="eyebrow">PIPELINE COUNTS</span>{selected.stages.map((stage, i) => <div key={i}><span>{i + 1}. {getStrategy(stage.method).name}</span><code>{stage.beforeTokens} → {stage.afterTokens}</code></div>)}</div>}
 <details className="explanation" open><summary>Why did this happen?</summary>{selected.notes.map((note, i) => <p key={i}>{note}</p>)}{selected.similarity && <p>Embedding: {selected.similarity.model}, {selected.similarity.dtype}; {selected.similarity.originalChunks} → {selected.similarity.compressedChunks} chunks. Cosine {selected.similarity.cosine.toFixed(4)}, dot {selected.similarity.dot.toFixed(4)}, Euclidean {selected.similarity.euclidean.toFixed(4)}, Manhattan {selected.similarity.manhattan.toFixed(4)}.</p>}</details>
 </> : <div className="empty-state"><div className="empty-symbol">x → f(x)</div><h3>Your prompt is the control.</h3><p>Click a compression method. Or run all seven transforms to see how mathematical weighting changes what survives.</p><button className="primary" disabled={busy || !input.trim()} onClick={() => void run('deduplicate', {}, ['deduplicate'])}>Try redundancy compression ↗</button><p className="fineprint">No API key. No fabricated results. Your first measurement starts here.</p></div>}
 </section>
 <section className="panel"><ParetoChart runs={chartRuns} selected={selected?.id} onSelect={setSelectedId}/></section>
 <section className="panel history"><div className="section-heading"><div><span className="eyebrow">04 / THE EVIDENCE</span><h2>Experiment notebook</h2></div><span className="badge">{matchingRuns.length} runs for this input</span></div><div className="table-scroll"><table><thead><tr><th>Method / transform</th><th>Tokens</th><th>Saved</th><th>Reduction</th><th>Factor</th><th>Cosine</th><th>Protection</th><th>ms</th></tr></thead><tbody>{matchingRuns.map(r => <tr key={r.id} className={selected?.id === r.id ? 'selected' : ''}><td><button className="table-link" onClick={() => setSelectedId(r.id)}>{r.methods.map(m => getStrategy(m).name).join(' → ')}<small>{r.settings.transform} · budget {percent(r.settings.budget)} · cutoff {r.settings.cutoff}</small></button></td><td>{r.metrics.originalTokens} → {r.metrics.compressedTokens}</td><td>{r.metrics.savedTokens}</td><td>{r.metrics.savingsPercent.toFixed(1)}%</td><td>{r.metrics.factor?.toFixed(2) ?? '—'}×</td><td>{r.similarity?.cosine.toFixed(4) ?? '—'}</td><td>{percent(r.metrics.protectionRate)}</td><td>{r.compressionMs.toFixed(1)}</td></tr>)}</tbody></table>{!matchingRuns.length && <p className="fineprint">No experiments yet. Results are real measurements, not sample numbers.</p>}</div><div className="row export-row"><label className="check"><input type="checkbox" checked={includeText} onChange={e => setIncludeText(e.target.checked)}/> Include prompt text in JSON</label><div className="row"><button className="small" disabled={!runs.length} onClick={() => download(JSON.stringify(exportData(runs, includeText), null, 2), 'tokenlab-experiments.json', 'application/json')}>Export JSON</button><button className="small" disabled={!runs.length} onClick={() => download(exportCsv(runs), 'tokenlab-experiments.csv', 'text/csv')}>CSV</button></div></div><p className="fineprint">Table is scoped to the current prompt and encoding; export includes all {runs.length} in-memory runs (up to 100), with input hashes. Refresh clears history. Hashes are not anonymization.</p></section>
 <section className="panel protection-panel"><details><summary><span><span className="eyebrow">INSPECT THE GUARDRAILS</span><strong>Protected content</strong></span><span className="badge">HEURISTIC DETECTION</span></summary><p>Detected instructions, negation, numbers, quotes, code and structural markers are protected. Entity and instruction detection is incomplete; inspect it and add exact text yourself.</p><label className="field">Additional exact strings to protect (one per line)<textarea value={customProtection} disabled={busy} onChange={e => setCustomProtection(e.target.value)} placeholder="A name, constraint, identifier or phrase the detector missed"/></label><p className="fineprint">Protection updates apply to the next run. Protected-occurrence retention verifies exact strings, not their relationships, correctness or complete information coverage.</p><div className="protection-list">{protectedSpans(input, customProtection.split('\n')).slice(0, 80).map((s, i) => <div key={i}><code>{s.text.slice(0, 120)}{s.text.length > 120 ? '…' : ''}</code><span>{s.reason}</span></div>)}</div></details></section>
 <GeminiArena key={selected?.id ?? 'none'} run={selected} defaultExpected={example?.text === input ? example.expected : undefined}/>
 </div></div>
 <section className="research-footer" id="research"><div><span className="eyebrow">READ THE INSTRUMENT CORRECTLY</span><h2>Fewer tokens is a measurement.<br />Better answers is a hypothesis.</h2></div><div><p><strong>Tokenization ≠ prompt compression.</strong> A tokenizer maps text to vocabulary IDs. TokenLab alters text and measures the result. Arithmetic on token IDs has no semantic meaning.</p><p><strong>Similarity ≠ equivalence.</strong> The embedding metric can miss negation, numbers and logical changes. Local frequency surprisal is not language-model perplexity. The model is primarily an English sentence encoder; pooled long-document scores are experimental.</p><p><strong>Inspired by research, not claiming a new state of the art.</strong> LLMLingua and LLMLingua-2 are separate research systems, not secretly powering these heuristics. Their optional comparison adapter is a documented next phase.</p><a href="https://github.com/microsoft/LLMLingua" target="_blank" rel="noreferrer">LLMLingua research ↗</a><a href="https://github.com/niieani/gpt-tokenizer" target="_blank" rel="noreferrer">Tokenizer implementation ↗</a><a href="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2" target="_blank" rel="noreferrer">Embedding model card ↗</a></div></section>
 <footer><span>TokenLab / open-source research software · MIT</span><button className="quiet" onClick={clear}>Clear prompt and session</button></footer>
 </main><div className={`statusbar ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite"><span className={busy ? 'pulse' : ''}>{busy ? '●' : error ? '!' : '◈'}</span><span>{error || (busy ? lab.progress : status || 'Local by default. You control every experiment.')}</span>{busy && <button className="small" onClick={() => { lab.stop(); update('useEmbeddings', false); setBusy(false); }}>Cancel</button>}</div></>;
}
