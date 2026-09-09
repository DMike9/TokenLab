import { DEFAULTS, type Settings } from './types.js';
import { TRANSFORMS } from './transforms.js';

/** Validate even unused controls: a recorded snapshot must be valid evidence. */
export function validateSettings(s: Settings): void {
    if (!s || Object.keys(s).some(k => !Object.hasOwn(DEFAULTS, k))) throw new Error('Unknown settings field.');
    const range = (value: number, min: number, max: number, name: string, integer = false) => {
        if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
            throw new Error(`${name} must be ${integer ? 'an integer' : 'finite'} in [${min}, ${max}].`);
    };
    for (const key of ['budget', 'cutoff', 'semanticFloor', 'redundancyThreshold', 'center'] as const) range(s[key], 0, 1, key);
    range(s.temperature, .05, 2, 'temperature'); range(s.steepness, 1, 20, 'steepness');
    range(s.ngramSize, 1, 5, 'ngramSize', true); range(s.minimumRepetitions, 2, 5, 'minimumRepetitions', true);
    if (!s.weights || Object.keys(s.weights).some(k => !Object.hasOwn(DEFAULTS.weights, k))) throw new Error('Invalid weights.');
    for (const key of Object.keys(DEFAULTS.weights) as (keyof Settings['weights'])[]) range(s.weights[key], 0, 1, `${key} weight`);
    if (!['o200k_base', 'cl100k_base', 'r50k_base'].includes(s.encoding) || !TRANSFORMS.some(t => t.id === s.transform)) throw new Error('Unsupported encoding or transform.');
    if (!s.taskFocus || !['auto', 'user', 'legacy'].includes(s.taskFocus.policy) || !(s.taskFocus.chunkId === null || typeof s.taskFocus.chunkId === 'string')) throw new Error('Invalid task focus.');
    if (!Array.isArray(s.protectedTerms) || !s.protectedTerms.every(t => typeof t === 'string') || typeof s.useEmbeddings !== 'boolean') throw new Error('Invalid protection or embedding settings.');
}
