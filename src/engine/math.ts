export const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x));
export function normalize(values: number[]): number[] {
    if (!values.length)
        return [];
    if (values.some(v => !Number.isFinite(v)))
        throw new Error('Scores must be finite.');
    const lo = Math.min(...values), hi = Math.max(...values);
    return hi === lo ? values.map(() => hi === 0 ? 0 : 0.5) : values.map(v => (v - lo) / (hi - lo));
}
export function vectorMetrics(a: number[], b: number[]) {
    if (!a.length || a.length !== b.length || [...a, ...b].some(v => !Number.isFinite(v)))
        throw new Error('Vectors must have equal, nonzero dimensions and finite values.');
    let dot = 0, aa = 0, bb = 0, euclidean = 0, manhattan = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        aa += a[i] ** 2;
        bb += b[i] ** 2;
        euclidean += (a[i] - b[i]) ** 2;
        manhattan += Math.abs(a[i] - b[i]);
    }
    if (!aa || !bb)
        throw new Error('Similarity is undefined for a zero vector.');
    const denominator = Math.sqrt(aa) * Math.sqrt(bb);
    if (!denominator || ![dot, aa, bb, euclidean, manhattan, denominator].every(Number.isFinite))
        throw new Error('Vector metrics exceed the finite numerical range.');
    return { cosine: clamp(dot / denominator, -1, 1), dot, euclidean: Math.sqrt(euclidean), manhattan };
}
export function normalizeVector(vector: number[]): number[] {
    if (!vector.length || vector.some(v => !Number.isFinite(v)))
        throw new Error('Embedding vectors must be nonempty and finite.');
    const norm = Math.hypot(...vector);
    if (!norm || !Number.isFinite(norm))
        throw new Error('The embedding model returned a zero vector.');
    return vector.map(v => v / norm);
}
export const words = (text: string): string[] => text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
export const characterCount = (text: string) => Array.from(text).length;
export function frequencies(text: string): Map<string, number> {
    const map = new Map<string, number>();
    for (const w of words(text.toLocaleLowerCase('en')))
        map.set(w, (map.get(w) ?? 0) + 1);
    return map;
}
export function entropy(text: string): number {
    const f = frequencies(text), total = [...f.values()].reduce((a, b) => a + b, 0);
    return total ? -[...f.values()].reduce((h, n) => h + n / total * Math.log2(n / total), 0) : 0;
}
export function ngrams(text: string, n: number): Set<string> {
    const ws = words(text.toLocaleLowerCase('en'));
    if (!ws.length)
        return new Set();
    const size = Math.max(1, Math.min(Math.floor(n), ws.length));
    return new Set(Array.from({ length: ws.length - size + 1 }, (_, i) => ws.slice(i, i + size).join(' ')));
}
export function jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size && !b.size)
        return 1;
    let common = 0;
    for (const v of a)
        if (b.has(v))
            common++;
    return common / (a.size + b.size - common);
}
export function lexicalCosine(a: string, b: string): number {
    const fa = frequencies(a), fb = frequencies(b);
    let dot = 0, aa = 0, bb = 0;
    for (const [w, n] of fa) {
        dot += n * (fb.get(w) ?? 0);
        aa += n * n;
    }
    for (const n of fb.values())
        bb += n * n;
    return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
