import { useEffect, useState } from 'react';
import type { Run } from '../engine/types.js';
interface Answer {
    text: string;
    elapsedMs: number;
    usage: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        thoughtsTokenCount?: number;
    };
    finishReason: string;
    exactMatch: boolean | null;
}
interface Evaluation {
    model: string;
    timestamp: string;
    settings: {
        temperature: number;
        maxOutputTokens: number;
    };
    original: Answer;
    compressed: Answer;
    outputsMatch: boolean;
    expected: string;
    caveat: string;
}
export function GeminiArena({ run, defaultExpected }: {
    run: Run | undefined;
    defaultExpected?: string;
}) {
    const [consent, setConsent] = useState(false), [health, setHealth] = useState<{
        configured: boolean;
        model: string;
    } | null>(null);
    const [expected, setExpected] = useState(defaultExpected ?? ''), [evaluation, setEvaluation] = useState<Evaluation | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { setEvaluation(null); setExpected(defaultExpected ?? ''); setError(''); }, [run?.id, defaultExpected]);
    const connect = async () => { setError(''); try {
        const response = await fetch('/api/health');
        if (!response.ok)
            throw new Error();
        const data = await response.json();
        if (typeof data.configured !== 'boolean')
            throw new Error();
        setHealth(data);
    }
    catch {
        setError('Local gateway is not running. Follow START-HERE.md: configure .env.local, then run npm run gemini in a second terminal.');
    } };
    const evaluate = async () => {
        if (!run || !consent || !health?.configured)
            return;
        setBusy(true);
        setError('');
        setEvaluation(null);
        try {
            const response = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TokenLab-Client': '1' }, body: JSON.stringify({ original: run.original, compressed: run.compressed, expected }), signal: AbortSignal.timeout(150000) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error ?? 'Evaluation failed.');
            setEvaluation(data);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Evaluation failed.');
        }
        finally {
            setBusy(false);
        }
    };
    const save = () => {
        if (!evaluation || !run)
            return;
        const blob = new Blob([JSON.stringify({ inputHash: run.inputHash, outputHash: run.outputHash, runId: run.id, evaluation }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'tokenlab-gemini-evaluation.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };
    return <details className="panel arena"><summary><span><span className="eyebrow">OPTIONAL / EXTERNAL</span><strong>Gemini Arena</strong></span><span className="badge">Does the answer survive?</span></summary>
  <p>Send the original and the selected compressed prompt to the same Gemini model, with the same generation settings. The local core does not need this.</p>
  <div className="notice warning">This sends both prompts to Google and can incur charges. Each comparison makes up to two generation calls. Never use confidential or sensitive inputs without appropriate authorization.</div>
  <label className="check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/> I authorize sending this prompt pair to Gemini.</label>
  <div className="row"><button disabled={!consent || busy} onClick={connect}>Check local gateway</button><span className="fineprint">{health ? health.configured ? `Configured: ${health.model}` : 'Gateway running; key or model not configured.' : 'Not connected. Key never enters the browser.'}</span></div>
  <label className="field">Expected answer (optional; enter before comparing)<input value={expected} onChange={e => setExpected(e.target.value)} placeholder="For the negation example: BLOCK" disabled={busy}/></label>
  <p className="fineprint">Expected-answer checks use exact trimmed text or canonical JSON equality. No reference means no task-accuracy score. Matching outputs alone is not proof of correctness.</p>
  <button className="primary" disabled={!consent || !health?.configured || !run || busy || !run.compressed.trim()} onClick={evaluate}>{busy ? 'Comparing with Gemini…' : 'Compare original vs compressed ↗'}</button>
  {error && <p className="error" role="alert">{error}</p>}
  {evaluation && <><div className="answer-grid">{(['original', 'compressed'] as const).map(side => <div key={side}><span className="eyebrow">{side.toUpperCase()} ANSWER</span><pre>{evaluation[side].text || '(No text returned)'}</pre><p className="fineprint">Gemini prompt tokens: {evaluation[side].usage.promptTokenCount ?? 'not reported'} · Total usage: {evaluation[side].usage.totalTokenCount ?? 'not reported'} · {(evaluation[side].elapsedMs / 1000).toFixed(2)}s · Finish: {evaluation[side].finishReason}</p><strong>{evaluation[side].exactMatch == null ? 'Reference accuracy not measured' : evaluation[side].exactMatch ? 'PASS · expected answer matched' : 'FAIL · expected answer did not match'}</strong></div>)}</div><p className="fineprint">{evaluation.caveat} The Arena uses provider-reported Gemini usage, not the selected GPT BPE encoding.</p><button onClick={save}>Export evaluation and answers</button></>}
 </details>;
}
