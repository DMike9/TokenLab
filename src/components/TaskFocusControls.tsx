import { useMemo } from 'react';
import type { Settings, TaskFocus } from '../engine/types.js';
import { chunkId, originalChunks, resolveTaskFocus } from '../engine/taskFocus.js';

export const focusLabel = (policy: TaskFocus['policy']) => ({ auto: 'Auto-detected', user: 'User selected', legacy: 'Legacy final chunk' })[policy];
export function TaskFocusControls({ text, settings, busy, onChange }: {
    text: string; settings: Settings; busy: boolean; onChange: (value: Settings['taskFocus']) => void;
}) {
    const termsKey = JSON.stringify(settings.protectedTerms);
    const chunks = useMemo(() => originalChunks(text, settings.protectedTerms), [text, termsKey]);
    const focus = useMemo(() => resolveTaskFocus(text, settings), [text, termsKey, settings.taskFocus]);
    const choices = chunks.filter(c => c.text.trim());
    return <section className="control-section task-focus" aria-label="Draft task focus">
        <h3>Task focus</h3>
        <p className="fineprint">Task focus changes relevance scoring. It does not change the original prompt sent through the experiment.</p>
        <label className="field">Task-focus policy<select aria-label="Task-focus policy" disabled={busy} value={settings.taskFocus.policy}
            onChange={e => onChange({ policy: e.target.value as TaskFocus['policy'], chunkId: e.target.value === 'user' ? focus.chunkId : null })}>
            <option value="auto">Auto-detected</option><option value="user">User selected</option><option value="legacy">Legacy final chunk</option>
        </select></label>
        {settings.taskFocus.policy === 'user' && <label className="field">Original chunk for task focus<select aria-label="Original chunk for task focus" disabled={busy || !choices.length}
            value={choices.some(c => chunkId(c) === settings.taskFocus.chunkId) ? settings.taskFocus.chunkId! : ''}
            onChange={e => onChange({ policy: 'user', chunkId: e.target.value || null })}>
            <option value="">Select an original chunk</option>{choices.map(c => <option key={chunkId(c)} value={chunkId(c)}>Chunk {c.index + 1}: {c.text.trim().slice(0, 120)}</option>)}
        </select></label>}
        <div className="focus-preview"><strong>{focusLabel(focus.policy)}{focus.fallback !== 'none' && ' · Fallback'}</strong>
            <p className="fineprint">{focus.chunkIndex == null ? 'No original chunk' : `Original chunk ${focus.chunkIndex + 1} of ${chunks.length}`} · chunk numbers include whitespace slices.</p>
            {focus.text && <blockquote>{focus.text}</blockquote>}<p className="fineprint">{focus.reason}</p>
        </div>
        <details><summary>Detection candidates ({focus.candidates.length})</summary>
            <p className="fineprint">English surface heuristic, not semantic understanding. Imperative +4; question +3; request language +2; protected instruction +1. Highest score wins; ties choose the earliest chunk. Code, JSON and quoted chunks are excluded. No credible candidate falls back to the final nonempty chunk.</p>
            <ol>{focus.candidates.map(c => <li key={c.chunkId}>Chunk {c.chunkIndex + 1} · {c.score} points: {c.reasons.join('; ')}</li>)}</ol>
        </details>
        <p className="fineprint">Used by importance, hybrid and similarity-guard deletion order. Selecting focus adds no protection. Chains keep this original focus even if an earlier stage removes it.</p>
    </section>;
}
