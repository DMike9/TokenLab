import type { Encoding, TokenInfo } from '../engine/types.js';
export interface Tokenizer {
    encode: (text: string) => number[];
    decode: (ids: number[]) => string;
    count: (text: string) => number;
}
const modules = {
    o200k_base: () => import('gpt-tokenizer/encoding/o200k_base'),
    cl100k_base: () => import('gpt-tokenizer/encoding/cl100k_base'),
    r50k_base: () => import('gpt-tokenizer/encoding/r50k_base'),
};
const cache = new Map<Encoding, Tokenizer>();
export async function getTokenizer(encoding: Encoding): Promise<Tokenizer> {
    const cached = cache.get(encoding);
    if (cached)
        return cached;
    if (!Object.hasOwn(modules, encoding))
        throw new Error('Unsupported encoding.');
    const codec = await modules[encoding]();
    // The lab treats pasted special-token-looking strings as ordinary literal text.
    const encode = (text: string) => codec.encode(text, { disallowedSpecial: new Set<string>() });
    const tokenizer = { encode, decode: (ids: number[]) => codec.decode(ids), count: (text: string) => encode(text).length };
    cache.set(encoding, tokenizer);
    return tokenizer;
}
export function inspectTokens(text: string, tokenizer: Tokenizer, limit = 2000): {
    tokens: TokenInfo[];
    total: number;
} {
    const ids = tokenizer.encode(text);
    return { total: ids.length, tokens: ids.slice(0, limit).map((id, index) => {
            const decoded = tokenizer.decode([id]);
            return { id, index, text: decoded, partialUtf8: decoded.includes('\uFFFD') };
        }) };
}
