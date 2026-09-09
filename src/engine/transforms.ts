import type { Settings, Transform } from './types.js';
import { clamp } from './math.js';
export const TRANSFORMS: {
    id: Transform;
    label: string;
    formula: string;
    explanation: string;
}[] = [
    { id: 'linear', label: 'Linear', formula: 'x', explanation: 'Leaves the heuristic score unchanged.' },
    { id: 'square', label: 'Square', formula: 'x²', explanation: 'Suppresses midrange scores relative to high scores.' },
    { id: 'sqrt', label: 'Square root', formula: '√x', explanation: 'Lifts low and medium scores, flattening their relative spread.' },
    { id: 'log', label: 'Log', formula: 'ln(1 + 9x) / ln(10)', explanation: 'An endpoint-normalized logarithm lifts the lower end.' },
    { id: 'exp', label: 'Exponential', formula: '(exp(4x) − 1) / (exp(4) − 1)', explanation: 'An endpoint-normalized exponential concentrates weight near one.' },
    { id: 'sigmoid', label: 'Sigmoid', formula: '1 / (1 + exp(−k(x − t)))', explanation: 'Smooth gating around center t; k controls steepness.' },
    { id: 'softmax', label: 'Softmax', formula: 'exp(xᵢ/T) / Σ exp(xⱼ/T)', explanation: 'Shares sum to one. Lower temperature concentrates the shares.' },
];
export function transformScores(scores: number[], settings: Pick<Settings, 'transform' | 'temperature' | 'steepness' | 'center'>): number[] {
    if (scores.some(v => !Number.isFinite(v) || v < 0 || v > 1))
        throw new Error('Importance scores must be finite values in [0, 1].');
    if (!Number.isFinite(settings.steepness) || settings.steepness <= 0 || !Number.isFinite(settings.center) || settings.center < 0 || settings.center > 1)
        throw new Error('Sigmoid steepness must be positive and finite; center must be in [0, 1].');
    if (!(settings.temperature > 0) || !Number.isFinite(settings.temperature))
        throw new Error('Temperature must be positive and finite.');
    if (!scores.length)
        return [];
    if (settings.transform === 'softmax') {
        const maximum = Math.max(...scores);
        const exps = scores.map(x => Math.exp((x - maximum) / settings.temperature));
        const total = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / total);
    }
    return scores.map(x => {
        switch (settings.transform) {
            case 'linear': return x;
            case 'square': return x * x;
            case 'sqrt': return Math.sqrt(x);
            case 'log': return Math.log1p(9 * x) / Math.log(10);
            case 'exp': return Math.expm1(4 * x) / Math.expm1(4);
            case 'sigmoid': return clamp(1 / (1 + Math.exp(-settings.steepness * (x - settings.center))));
            default: throw new Error('Unknown pointwise transform.');
        }
    });
}
