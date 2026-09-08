export interface DiffPart {
    kind: 'same' | 'removed' | 'added';
    text: string;
}
/** Word/whitespace LCS. Bounded matrix; very long comparisons retain a correct coarse prefix/suffix diff. */
export function diffText(original: string, compressed: string): {
    parts: DiffPart[];
    coarse: boolean;
} {
    if (original === compressed)
        return { parts: original ? [{ kind: 'same', text: original }] : [], coarse: false };
    const a = original.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
    const b = compressed.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
    let prefix = 0, suffix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
        prefix++;
    while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix])
        suffix++;
    const aa = a.slice(prefix, a.length - suffix), bb = b.slice(prefix, b.length - suffix);
    const parts: DiffPart[] = [];
    const push = (kind: DiffPart['kind'], text: string) => { if (!text)
        return; const last = parts.at(-1); if (last?.kind === kind)
        last.text += text;
    else
        parts.push({ kind, text }); };
    push('same', a.slice(0, prefix).join(''));
    const coarse = aa.length * bb.length > 2000000;
    if (coarse) {
        push('removed', aa.join(''));
        push('added', bb.join(''));
    }
    else {
        const width = bb.length + 1, table = new Uint32Array((aa.length + 1) * width);
        for (let i = aa.length - 1; i >= 0; i--)
            for (let j = bb.length - 1; j >= 0; j--)
                table[i * width + j] = aa[i] === bb[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
        let i = 0, j = 0;
        while (i < aa.length || j < bb.length) {
            if (i < aa.length && j < bb.length && aa[i] === bb[j]) {
                push('same', aa[i++]);
                j++;
            }
            else if (i < aa.length && (j === bb.length || table[(i + 1) * width + j] >= table[i * width + j + 1]))
                push('removed', aa[i++]);
            else
                push('added', bb[j++]);
        }
    }
    push('same', suffix ? a.slice(a.length - suffix).join('') : '');
    return { parts, coarse };
}
