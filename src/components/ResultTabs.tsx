import type { ReactNode } from 'react';

const VIEWS = [['diff', 'Visual diff'], ['side', 'Side by side'], ['scores', 'Why it survived'], ['tokens', 'Original tokens']] as const;
export type ResultView = typeof VIEWS[number][0];

export function ResultTabs({ value, onChange, children }: {
    value: ResultView;
    onChange: (value: ResultView) => void;
    children: Record<ResultView, ReactNode>;
}) {
    return <>
        <div className="tabs" role="tablist" aria-label="Result views">
            {VIEWS.map(([id, label], index) => <button key={id} id={`result-tab-${id}`} type="button" role="tab"
                aria-selected={value === id} aria-controls={`result-panel-${id}`} tabIndex={value === id ? 0 : -1}
                onClick={() => onChange(id)} onKeyDown={event => {
                    let next: number;
                    switch (event.key) {
                        case 'ArrowRight': next = (index + 1) % VIEWS.length; break;
                        case 'ArrowLeft': next = (index + VIEWS.length - 1) % VIEWS.length; break;
                        case 'Home': next = 0; break;
                        case 'End': next = VIEWS.length - 1; break;
                        default: return;
                    }
                    event.preventDefault();
                    onChange(VIEWS[next][0]);
                    document.getElementById(`result-tab-${VIEWS[next][0]}`)?.focus();
                }}>{label}</button>)}
        </div>
        {VIEWS.map(([id]) => <div key={id} id={`result-panel-${id}`} role="tabpanel" aria-labelledby={`result-tab-${id}`}
            tabIndex={0} hidden={value !== id}>{value === id && children[id]}</div>)}
    </>;
}
