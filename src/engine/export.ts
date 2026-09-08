import type { Run } from './types.js';
export function exportData(runs: Run[], includeText: boolean) {
    return { format: 'tokenlab-experiments', schemaVersion: 1, exportedAt: new Date().toISOString(), includesPromptText: includeText,
        warning: 'Input hashes are identifiers, not anonymization. They can be guessed for known prompts.',
        experiments: runs.map(run => includeText ? run : ({ ...run, original: undefined, compressed: undefined, decisions: run.decisions.map(d => ({ ...d, text: undefined })), settings: { ...run.settings, protectedTerms: [] } })),
    };
}
const csvCell = (value: unknown): string => {
    let s = value == null ? '' : String(value);
    // Prevent spreadsheet formula execution in exported user-originated strings.
    if (/^[=+@\-\t\r]/.test(s))
        s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
};
export function exportCsv(runs: Run[]): string {
    const fields = ['id', 'input_hash', 'methods', 'encoding', 'transform', 'budget', 'cutoff', 'original_tokens', 'compressed_tokens', 'saved_tokens', 'savings_percent', 'factor', 'cosine_similarity', 'protected_retention', 'compression_ms', 'total_ms'];
    const rows = runs.map(r => [r.id, r.inputHash, r.methods.join(' > '), r.settings.encoding, r.settings.transform, r.settings.budget, r.settings.cutoff,
        r.metrics.originalTokens, r.metrics.compressedTokens, r.metrics.savedTokens, r.metrics.savingsPercent, r.metrics.factor, r.similarity?.cosine, r.metrics.protectionRate, r.compressionMs, r.totalMs]);
    return [fields, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
