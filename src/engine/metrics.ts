import { characterCount, words } from './math.js';
import { protectionRetention } from './protection.js';
import type { Count, Metrics } from './types.js';
export function calculateMetrics(original: string, compressed: string, count: Count, custom: string[] = []): Metrics {
    const originalTokens = count(original), compressedTokens = count(compressed);
    const savedTokens = originalTokens - compressedTokens;
    const protection = protectionRetention(original, compressed, custom);
    const originalCharacters = characterCount(original), compressedCharacters = characterCount(compressed);
    const originalWords = words(original).length, compressedWords = words(compressed).length;
    return {
        originalTokens, compressedTokens, savedTokens, savingsPercent: originalTokens ? savedTokens / originalTokens * 100 : 0,
        rate: originalTokens ? compressedTokens / originalTokens : null, factor: compressedTokens ? originalTokens / compressedTokens : null,
        originalCharacters, compressedCharacters, removedCharacters: originalCharacters - compressedCharacters,
        originalWords, compressedWords, removedWords: originalWords - compressedWords,
        protectedTotal: protection.total, protectedRetained: protection.retained, protectionRate: protection.rate,
    };
}
export interface Point {
    id: string;
    tokens: number;
    similarity: number;
}
export function paretoFrontier(points: Point[]): Set<string> {
    const valid = points.filter(p => Number.isFinite(p.tokens) && Number.isFinite(p.similarity));
    return new Set(valid.filter(p => !valid.some(q => q.tokens <= p.tokens && q.similarity >= p.similarity && (q.tokens < p.tokens || q.similarity > p.similarity))).map(p => p.id));
}
