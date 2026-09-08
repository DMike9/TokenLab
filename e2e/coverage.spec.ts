import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { EXAMPLES } from '../src/examples.js';
import { STRATEGIES } from '../src/engine/strategies.js';
import { TRANSFORMS } from '../src/engine/transforms.js';
import { getTokenizer } from '../src/tokenizer/index.js';
import { protectionRetention } from '../src/engine/protection.js';
import type { Run } from '../src/engine/types.js';

async function exportRuns(page: Page, includeText = true): Promise<Run[]> {
    await page.getByLabel('Include prompt text in JSON').setChecked(includeText);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    return JSON.parse(await readFile((await (await downloaded).path())!, 'utf8')).experiments;
}
async function runMethod(page: Page, name: string) {
    await page.locator('.method-card').filter({ hasText: name }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
}
test('all examples and deterministic methods preserve occurrences and use exact full-string BPE', async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    const tokenizer = await getTokenizer('o200k_base');
    for (const example of EXAMPLES) {
        await page.getByLabel('Load example').selectOption(example.id);
        for (const method of STRATEGIES.filter(s => s.id !== 'similarity')) {
            await runMethod(page, method.name);
        }
    }
    const runs = await exportRuns(page);
    expect(runs).toHaveLength(EXAMPLES.length * 7);
    for (const run of runs) {
        expect(run.metrics.originalTokens).toBe(tokenizer.count(run.original));
        expect(run.metrics.compressedTokens).toBe(tokenizer.count(run.compressed));
        expect(run.metrics.compressedTokens).toBeLessThanOrEqual(run.metrics.originalTokens);
        const retained = protectionRetention(run.original, run.compressed, []);
        expect(retained.retained).toBe(retained.total);
        expect(run.similarity).toBeNull();
        if (run.budgetMet) expect(run.metrics.compressedTokens).toBeLessThanOrEqual(Math.floor(run.metrics.originalTokens * run.settings.budget));
        if (run.methods[0] === 'baseline') expect(run.compressed).toBe(run.original);
    }
    expect(errors).toEqual([]);
});
test('math controls, infeasible protection, chain counts, diffs and both export formats', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Load example').selectOption('negation');
    await page.getByLabel('Target retained', { exact: true }).fill('0.1');
    await page.getByRole('button', { name: 'Run all 7 transforms against this prompt' }).click();
    await expect(page.locator('.statusbar')).toContainText('Completed 7 transforms');
    let runs = await exportRuns(page);
    expect(runs.map(r => r.settings.transform)).toEqual(TRANSFORMS.map(t => t.id));
    expect(runs.every(r => r.budgetMet === false)).toBe(true);
    for (const transform of TRANSFORMS) {
        await page.getByRole('button', { name: transform.label, exact: true }).click();
        await expect(page.locator('.statusbar')).toContainText('complete');
    }
    await page.getByLabel('Temperature', { exact: true }).fill('0.1');
    await page.getByLabel('Shaped-score cutoff', { exact: true }).fill('0.4');
    await runMethod(page, 'Importance + math');
    await page.getByRole('button', { name: 'Sigmoid', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await page.getByRole('slider', { name: 'Sigmoid steepness k' }).fill('18');
    await page.getByRole('slider', { name: 'Sigmoid center t' }).fill('0.7');
    await runMethod(page, 'Importance + math');
    await page.getByText('Chain operations', { exact: true }).click();
    await page.getByLabel('Use ordered pipeline on Run experiment').check();
    await page.getByRole('button', { name: /Run pipeline/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(page.locator('.pipeline-result > div')).toHaveCount(4);
    runs = await exportRuns(page);
    expect(runs[14].settings).toMatchObject({ temperature: .1, cutoff: .4 });
    expect(runs[16].settings).toMatchObject({ steepness: 18, center: .7 });
    const chain = runs.at(-1)!;
    expect(chain.methods).toEqual(['minify', 'deduplicate', 'lexical', 'importance']);
    expect(chain.stages[0].beforeTokens).toBe(chain.metrics.originalTokens);
    chain.stages.forEach((s, i) => {
        expect(s.afterTokens).toBeLessThanOrEqual(s.beforeTokens);
        if (i) expect(s.beforeTokens).toBe(chain.stages[i - 1].afterTokens);
    });
    await page.getByRole('tab', { name: 'Visual diff' }).click();
    const diff = await page.locator('.diff-text > span').evaluateAll(nodes => nodes.map(n => ({ kind: n.className, text: n.textContent })));
    expect(diff.filter(d => d.kind !== 'diff-added').map(d => d.text).join('')).toBe(chain.original);
    expect(diff.filter(d => d.kind !== 'diff-removed').map(d => d.text).join('')).toBe(chain.compressed);
    const redacted = await exportRuns(page, false);
    redacted.forEach(r => {
        expect(r).not.toHaveProperty('original');
        expect(r).not.toHaveProperty('compressed');
        r.decisions.forEach(d => expect(d).not.toHaveProperty('text'));
    });
    const csvPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const csv = await readFile((await (await csvPromise).path())!, 'utf8');
    expect(csv.split('\r\n')).toHaveLength(runs.length + 1);
    expect(csv).toContain('"compressed_tokens"');
});
test('Unicode token inspection across encodings, custom protection and mobile results', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const input = 'café 🌱 中文 👩🏽‍💻 e\u0301 <|endoftext|>\nordinary   background. rare phrase. rare phrase. Do NOT change 42.';
    await page.getByLabel('Original prompt', { exact: true }).fill(input);
    await page.locator('.protection-panel summary').click();
    await page.getByLabel('Additional exact strings to protect (one per line)').fill('rare phrase');
    for (const encoding of ['o200k_base', 'cl100k_base', 'r50k_base'] as const) {
        await page.getByLabel('Tokenizer encoding').selectOption(encoding);
        await runMethod(page, 'Baseline');
        await page.getByRole('tab', { name: 'Original tokens' }).click();
        const tokens = (await getTokenizer(encoding)).encode(input);
        expect(await page.locator('.token-cloud button').count()).toBe(tokens.length);
        await page.locator('.token-cloud button').nth(2).click();
        await expect(page.locator('.token-detail')).toContainText(`2 / ${tokens[2]}`);
    }
    await runMethod(page, 'Importance + math');
    const runs = await exportRuns(page);
    expect(runs.at(-1)!.compressed.match(/rare phrase/g)).toHaveLength(2);
    await page.getByRole('tab', { name: 'Visual diff' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('tokenlab-mobile.png'), fullPage: true });
    await page.locator('.results').screenshot({ path: info.outputPath('tokenlab-mobile-results.png') });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: info.outputPath('tokenlab-mobile-top.png') });
    await page.getByRole('button', { name: 'Clear prompt and session' }).click();
    await expect(page.getByLabel('Original prompt', { exact: true })).toHaveValue('');
    await expect(page.locator('.history tbody tr')).toHaveCount(0);
});
