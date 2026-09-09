import type { Decision, Run } from './types.js';
const redactDecision = ({ text: _text, ...decision }: Decision) => decision;
export function exportData(runs: Run[], includeText: boolean) {
    return { format: 'tokenlab-experiments', schemaVersion: 2, exportedAt: new Date().toISOString(), includesPromptText: includeText,
        warning: 'Input hashes are identifiers, not anonymization. They can be guessed for known prompts.',
        experiments: runs.map(run => includeText ? run : ({ ...run, original: undefined, compressed: undefined,
            taskFocus: { ...run.taskFocus, text: undefined }, decisions: run.decisions.map(redactDecision),
            stages: run.stages.map(stage => ({ ...stage, decisions: stage.decisions.map(redactDecision) })),
            settings: { ...run.settings, protectedTerms: [] } })),
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
    const fields = ['id', 'input_hash', 'methods', 'encoding', 'transform', 'budget', 'cutoff', 'original_tokens', 'compressed_tokens', 'saved_tokens', 'savings_percent', 'factor', 'cosine_similarity', 'protected_retention', 'compression_ms', 'total_ms', 'task_focus_policy', 'task_focus_chunk_id', 'task_focus_sha256', 'task_focus_reason', 'task_focus_fallback', 'task_focus_algorithm', 'scoring_weights', 'chunk_scoring'];
    const rows = runs.map(r => [r.id, r.inputHash, r.methods.join(' > '), r.settings.encoding, r.settings.transform, r.settings.budget, r.settings.cutoff,
        r.metrics.originalTokens, r.metrics.compressedTokens, r.metrics.savedTokens, r.metrics.savingsPercent, r.metrics.factor, r.similarity?.cosine, r.metrics.protectionRate, r.compressionMs, r.totalMs,
        r.taskFocus.policy, r.taskFocus.chunkId, r.taskFocus.textHash, r.taskFocus.reason, r.taskFocus.fallback, r.taskFocus.algorithm,
        JSON.stringify(r.settings.weights), JSON.stringify(r.stages.map(s => ({ method: s.method, decisions: s.decisions.map(redactDecision) })))]);
    return [fields, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
