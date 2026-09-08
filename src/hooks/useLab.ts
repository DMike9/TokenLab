import { useEffect, useRef, useState } from 'react';
import type { Encoding, Method, Metrics, Run, Settings, Span, TokenInfo } from '../engine/types.js';
export interface Analysis {
    input: string;
    encoding: Encoding;
    tokens: TokenInfo[];
    total: number;
    metrics: Metrics;
    protection: Span[];
}
type Pending = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
};
export function useLab() {
    const worker = useRef<Worker | null>(null), pending = useRef(new Map<number, Pending>()), counter = useRef(0);
    const [progress, setProgress] = useState('Everything starts with the original prompt.');
    const stop = () => {
        worker.current?.terminate();
        worker.current = null;
        for (const p of pending.current.values())
            p.reject(new Error('Operation cancelled. Local model state was reset.'));
        pending.current.clear();
    };
    useEffect(() => () => { worker.current?.terminate(); for (const p of pending.current.values())
        p.reject(new Error('Worker closed.')); pending.current.clear(); }, []);
    const ensure = () => {
        if (worker.current)
            return worker.current;
        const w = new Worker(new URL('../workers/lab.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (event: MessageEvent<{
            id: number;
            progress?: string;
            error?: string;
            result?: unknown;
        }>) => {
            const { id, progress: message, error, result } = event.data;
            if (message) {
                setProgress(message);
                return;
            }
            const p = pending.current.get(id);
            if (!p)
                return;
            if (error)
                p.reject(new Error(error));
            else
                p.resolve(result);
            pending.current.delete(id);
        };
        w.onerror = event => {
            const error = new Error(event.message || 'Browser worker failed to load. Verify dependencies and browser support.');
            for (const p of pending.current.values())
                p.reject(error);
            pending.current.clear();
            w.terminate();
            worker.current = null;
        };
        worker.current = w;
        return w;
    };
    const request = <T,>(action: 'analyze' | 'run' | 'embeddings' | 'clear', settings: Settings, text?: string, methods?: Method[]): Promise<T> => {
        const id = ++counter.current;
        return new Promise<T>((resolve, reject) => {
            try {
                const w = ensure();
                pending.current.set(id, { resolve: v => resolve(v as T), reject });
                w.postMessage({ id, action, settings, text, methods });
            }
            catch (error) {
                pending.current.delete(id);
                reject(error);
            }
        });
    };
    return { progress, stop, analyze: (text: string, settings: Settings) => request<Analysis>('analyze', settings, text),
        run: (text: string, methods: Method[], settings: Settings) => request<Run>('run', settings, text, methods),
        enable: (settings: Settings) => request<boolean>('embeddings', settings), clear: (settings: Settings) => request<boolean>('clear', settings),
    };
}
