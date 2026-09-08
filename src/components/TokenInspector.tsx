import { useState } from 'react';
import type { TokenInfo } from '../engine/types.js';
export function TokenInspector({ tokens, total }: {
    tokens: TokenInfo[];
    total: number;
}) {
    const [selected, setSelected] = useState(0), [page, setPage] = useState(0);
    const pageSize = 120, visible = tokens.slice(page * pageSize, (page + 1) * pageSize), token = tokens[selected];
    return <div className="token-inspector"><p className="fineprint">Click a BPE token. IDs are vocabulary lookup labels, not semantic values. Token boundaries can split a Unicode character.</p>
  <div className="token-cloud">{visible.map(t => <button key={t.index} className={`token token-${t.index % 5} ${t.index === selected ? 'chosen' : ''}`} title={`ID ${t.id} · position ${t.index}`} onClick={() => setSelected(t.index)}>{t.text.replace(/ /g, '·').replace(/\n/g, '↵\n') || '∅'}</button>)}</div>
  {token && <div className="token-detail"><div><small>POSITION / ID</small><code>{token.index} / {token.id}</code></div><div><small>DECODED TEXT</small><code>{JSON.stringify(token.text)}</code></div><div><small>NEIGHBOR IDS</small><code>{token.index > 0 ? tokens[token.index - 1]?.id : 'start'} ← {token.id} → {tokens[token.index + 1]?.id ?? 'end'}</code></div><div><small>DECODED TEXT UTF-8</small><code>{token.partialUtf8 ? 'Partial UTF-8 or literal replacement character; raw token bytes unavailable.' : Array.from(new TextEncoder().encode(token.text)).map(b => b.toString(16).padStart(2, '0')).join(' ')}</code></div></div>}
  <div className="row"><span className="fineprint">Showing {Math.min(total, page * pageSize + 1)}–{Math.min(tokens.length, (page + 1) * pageSize)} of {total.toLocaleString()} tokens. {total > tokens.length && `Inspection capped at ${tokens.length}; counting uses the full prompt.`}</span><div className="row"><button className="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button><button className="small" disabled={(page + 1) * pageSize >= tokens.length} onClick={() => setPage(p => p + 1)}>→</button></div></div>
  <p className="fineprint">The hex display encodes the decoded token text, not a raw-vocabulary byte dump. Individual replacement characters are never used to reconstruct or compress the prompt.</p>
 </div>;
}
