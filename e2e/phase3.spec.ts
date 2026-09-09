import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Run } from '../src/engine/types.js';
import { assertStudyControls, chunkCounts, compareDecisions, targetTokens } from '../src/engine/studies.js';
import { getTokenizer } from '../src/tokenizer/index.js';

async function exported(page: Page, text = false): Promise<Run[]> {
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Include prompt text in JSON').setChecked(text);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    return JSON.parse(await readFile((await (await download).path())!, 'utf8')).experiments;
}
async function preset(page: Page, name: string) {
    const details = page.locator('.study-presets');
    if (!(await details.getAttribute('open') !== null)) await details.locator('summary').click();
    await details.getByRole('button', { name }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
}

for (const [width, height] of [[1440,1000], [1024,768], [390,844]]) test(`controlled math and paired decisions at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [], remote: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:')) remote.push(r.url()); });
    await page.goto('/');
    await page.getByLabel('Load example').selectOption('math-study');
    const original = await page.getByLabel('Original prompt', { exact: true }).inputValue();
    await page.getByRole('button', { name: /Analyze prompt/ }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
    await page.getByRole('button', { name: 'Compare math ↗', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Completed 7 transforms');
    const panel = page.locator('.study-results');
    await expect(panel.locator('.study-table tbody tr')).toHaveCount(7);
    await expect(panel).toContainText('ONLY TRANSFORM CHANGES');
    await expect(panel).toContainText('local embeddings were disabled');
    await expect(page.getByLabel('Original prompt', { exact: true })).toHaveValue(original);
    const runs = await exported(page, true);
    assertStudyControls(runs, 'transforms');
    const tokenizer = await getTokenizer(runs[0].settings.encoding);
    const sigmoid = runs.find(r => r.settings.transform === 'sigmoid')!, softmax = runs.find(r => r.settings.transform === 'softmax')!;
    await expect(panel.locator('.study-learning')).toContainText(`Softmax retained ${chunkCounts(softmax).kept} chunks; Sigmoid retained ${chunkCounts(sigmoid).kept}`);
    for (const r of runs) expect(r.metrics.compressedTokens).toBe(tokenizer.count(r.compressed));
    await panel.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: info.outputPath(`study-${width}.png`) });
    await panel.locator('.pair-comparison > summary').click();
    await panel.locator('.chunk-comparison > summary').click();
    await expect(panel.locator('.chunk-comparison tbody tr')).toHaveCount(sigmoid.decisions.length);
    const comparisons = compareDecisions(sigmoid, softmax);
    for (const [i, row] of comparisons.entries()) {
        const cells = panel.locator('.chunk-comparison tbody tr').nth(i);
        await expect(cells).toContainText(row.sigmoid.originalScore.toFixed(4));
        await expect(cells).toContainText(row.sigmoid.transformedScore.toFixed(4));
        await expect(cells).toContainText(row.softmax.transformedScore.toFixed(4));
        await expect(cells).toContainText(row.agreement);
    }
    await panel.locator('.pair-comparison').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: info.outputPath(`pair-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await panel.locator('.study-curves > summary').click();
    await panel.getByLabel('Compare independent curves').check();
    await expect(panel.locator('.curve-legend')).toContainText('Sigmoid');
    await expect(panel.locator('.softmax-example')).toContainText('0.5741');
    await panel.getByRole('button', { name: 'Inspect Sigmoid result', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Recorded result settings')).toContainText('sigmoid');
    const parts = await page.locator('.diff-text > span').evaluateAll(nodes => nodes.filter(n => n.className !== 'diff-removed').map(n => n.textContent).join(''));
    expect(parts).toBe(sigmoid.compressed);
    await page.getByLabel('Target retained', { exact: true }).fill('0.3');
    await expect(panel).toContainText('Controls changed since this study');
    const redacted = await exported(page);
    expect(redacted[0].study?.id).toBe(runs[0].study?.id);
    expect(JSON.stringify(redacted)).not.toContain('"text":');
    expect(redacted[0].settings.budget).toBe(.65);
    expect(errors).toEqual([]); expect(remote).toEqual([]);
    await writeFile(info.outputPath('study-evidence.json'), JSON.stringify({ viewport: { width, height }, errors, remote, runs }, null, 2));
});

test('pair preset and ladder keep actual budgets inspectable and preserve earlier study history', async ({ page }) => {
    await page.goto('/'); await page.getByLabel('Load example').selectOption('math-study');
    await preset(page, 'Sigmoid vs Softmax');
    await expect(page.locator('.pair-comparison')).toHaveAttribute('open', '');
    await expect(page.locator('.study-table tbody tr')).toHaveCount(2);
    const pair = await exported(page, true); assertStudyControls(pair, 'sigmoid-softmax');
    await page.getByLabel('Original prompt', { exact: true }).fill('Do NOT delete the database.');
    await preset(page, 'Compression vs preservation');
    const ladder = await exported(page, true); assertStudyControls(ladder, 'ladder');
    await expect(page.locator('.settings-changed')).toHaveCount(0);
    for (const run of ladder) {
        const card = page.locator('.ladder button').filter({ hasText: `${Math.round(run.settings.budget * 100)}% target` });
        await expect(card).toContainText(`${targetTokens(run)} target → ${run.metrics.compressedTokens} actual tokens`);
        await expect(card).toContainText('100.0% actually retained'); await expect(card).toContainText('Budget unmet');
        await card.click(); await expect(page.locator('.diff-text')).toHaveText(run.original);
    }
    await page.getByLabel('Export scope').selectOption('session');
    expect(await exported(page)).toHaveLength(6);
    await page.getByLabel('Load example').selectOption('math-study');
    await page.locator('.history tbody tr').first().getByRole('button').click();
    await expect(page.locator('.study-table tbody tr')).toHaveCount(2);
    await expect(page.locator('#study-heading')).toHaveText('Sigmoid vs Softmax');
});

test('cancelling a study publishes no partial group and ignores its late transport response', async ({ page }) => {
    // Transport timing seam only; messages still contain results from the real worker/engine.
    await page.addInitScript(() => {
        const Real = window.Worker;
        window.Worker = class {
            inner: Worker; onmessage: ((event: MessageEvent) => void) | null = null; onerror: ((event: ErrorEvent) => void) | null = null;
            constructor(url: string | URL, options?: WorkerOptions) {
                this.inner = new Real(url, options);
                this.inner.onmessage = event => { setTimeout(() => this.onmessage?.(event), 600); };
                this.inner.onerror = event => this.onerror?.(event);
            }
            postMessage(message: unknown) { this.inner.postMessage(message); }
            terminate() { this.inner.terminate(); }
        } as unknown as typeof Worker;
    });
    await page.goto('/');
    await page.getByRole('button', { name: /Analyze prompt/ }).click(); await expect(page.locator('.statusbar')).toContainText('analyzed');
    const button = page.getByRole('button', { name: 'Compare math ↗', exact: true });
    await button.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
    await expect(page.getByLabel('Original prompt', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.study-results')).toHaveCount(0);
    await page.getByLabel('Original prompt', { exact: true }).fill('Do NOT delete the database.');
    await button.click(); await expect(page.locator('.statusbar')).toContainText('Completed 7 transforms');
    const runs = await exported(page, true);
    expect(runs).toHaveLength(7); assertStudyControls(runs, 'transforms');
    expect(runs.every(r => r.original === 'Do NOT delete the database.')).toBe(true);
    await expect(page.locator('.study-learning')).toContainText('selected the same chunks and produced identical text');
    await page.getByRole('button', { name: 'Clear prompt and session' }).click();
    await expect(page.locator('.study-results')).toHaveCount(0);
});
