export function embeddingWindows(text: string, tokenLength: (text: string) => number): { text: string; weight: number }[] {
    // Count with the EMBEDDING model's tokenizer, not the GPT encoding. Preserve the exact input substrings.
    // Binary search chooses a safe prefix; the explicit final token check prevents silent truncation.
    const codepoints = Array.from(text), pieces: {
        text: string;
        weight: number;
    }[] = [];
    let at = 0;
    while (at < codepoints.length) {
        if (pieces.length >= 128)
            throw new Error('This input exceeds the local embedding limit of 128 chunks. No truncated score was computed.');
        let lo = 1, hi = Math.min(codepoints.length - at, 2048), best = 0, length = 0;
        while (lo <= hi) {
            const middle = Math.floor((lo + hi) / 2), part = codepoints.slice(at, at + middle).join('');
            const tokens = tokenLength(part);
            if (tokens <= 254) {
                best = middle;
                length = tokens;
                lo = middle + 1;
            }
            else
                hi = middle - 1;
        }
        if (!best)
            throw new Error('A chunk could not be encoded safely within the model window.');
        const part = codepoints.slice(at, at + best).join('');
        if (tokenLength(part) > 254)
            throw new Error('Chunk would be truncated; similarity was not computed.');
        if (part.trim() && length)
            pieces.push({ text: part, weight: length });
        at += best;
    }
    if (!pieces.length)
        throw new Error('The embedding tokenizer produced no content tokens.');
    return pieces;
}
