import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Run } from '../src/engine/types.js';

async function run(page: Page) {
    await page.locator('.method-card').filter({ hasText: 'Weighted hybrid' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
}
async function exportRuns(page: Page, includeText = false): Promise<Run[]> {
    await page.getByLabel('Include prompt text in JSON').setChecked(includeText);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    return JSON.parse(await readFile((await (await pending).path())!, 'utf8')).experiments;
}

for (const width of [1440, 390]) test(`task-focus comparison and score inspection at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/');
    await expect(page.getByLabel('Task-focus policy', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Load example').selectOption('task-focus');
    const prompt = await page.getByLabel('Original prompt', { exact: true }).inputValue();
    const policy = page.getByLabel('Task-focus policy', { exact: true });
    const preview = page.getByLabel('Draft task focus');
    await expect(policy).toHaveValue('auto');
    await expect(preview.locator('blockquote')).toHaveText('Summarize the orchard irrigation risk.');
    await preview.getByText(/Detection candidates/).click();
    await expect(preview).toContainText('Instruction-like imperative');
    await preview.screenshot({ path: info.outputPath(`task-focus-${width}.png`) });
    await run(page);
    const recorded = await page.getByLabel('Recorded result settings').innerText();
    await policy.selectOption('legacy');
    await expect(page.locator('.settings-changed')).toBeVisible();
    expect(await page.getByLabel('Recorded result settings').innerText()).toBe(recorded);
    await expect(preview.locator('blockquote')).toContainText('butterflies');
    await run(page);
    await policy.selectOption('user');
    const choices = page.getByLabel('Original chunk for task focus', { exact: true });
    const choice = await choices.locator('option').filter({ hasText: 'orchard irrigation depends' }).first().getAttribute('value');
    await choices.selectOption(choice!);
    await run(page);
    await expect(page.locator('.settings-changed')).toHaveCount(0);
    await expect(page.getByLabel('Original prompt', { exact: true })).toHaveValue(prompt);
    await expect(page.locator('.history tbody tr')).toHaveCount(3);
    await expect(page.locator('.history tbody tr').nth(0)).toContainText('Auto-detected');
    await expect(page.locator('.history tbody tr').nth(1)).toContainText('Legacy final chunk');
    await expect(page.locator('.history tbody tr').nth(2)).toContainText('User selected');
    await page.getByRole('tab', { name: 'Why it survived' }).click();
    const detail = page.locator('.score-details').first();
    await detail.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(detail).toHaveAttribute('open', '');
    await expect(detail).toContainText('Experimental heuristic — not a learned importance probability');
    await expect(detail).toContainText('Hard protection bypasses deletion');
    await detail.screenshot({ path: info.outputPath(`contributions-${width}.png`) });
    const scores = page.getByRole('tab', { name: 'Why it survived' });
    await scores.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Side by side' })).toBeFocused();
    const runs = await exportRuns(page, true);
    expect(runs.map(r => r.taskFocus.policy)).toEqual(['auto', 'legacy', 'user']);
    expect(runs.every(r => r.original === prompt && r.inputHash === runs[0].inputHash)).toBe(true);
    for (const r of runs) {
        expect(r.taskFocus.textHash).toMatch(/^[a-f0-9]{64}$/);
        expect(r.metrics.protectedRetained).toBe(r.metrics.protectedTotal);
        expect(r.decisions.filter(d => d.hardProtected).every(d => d.kept)).toBe(true);
        expect(r.decisions.filter(d => d.scoring).every(d => d.scoring!.focusId === r.taskFocus.chunkId)).toBe(true);
    }
    const relevance = (r: Run) => r.decisions.find(d => d.text.includes('orchard irrigation depends'))!.scoring!.features.relevance;
    expect(relevance(runs[0])).toBeGreaterThan(relevance(runs[1]));
    const redacted = await exportRuns(page);
    expect(JSON.stringify(redacted)).not.toContain('orchard');
    expect(redacted[2].taskFocus.textHash).toBe(runs[2].taskFocus.textHash);
    expect(redacted[2].decisions[0].scoring).toEqual(runs[2].decisions[0].scoring);
    await page.locator('.history').screenshot({ path: info.outputPath(`notebook-${width}.png`) });
    await page.getByLabel('Target retained', { exact: true }).fill('0.1');
    await run(page);
    await expect(page.locator('.result-explanation')).toContainText('Target budget not met');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(policy).toBeHidden();
    await expect(page.getByLabel('Original prompt', { exact: true })).toHaveValue(prompt);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await writeFile(info.outputPath('focus-evidence.json'), JSON.stringify({ runs: redacted, errors }, null, 2));
});

test('no-task and stale user selection display honest fallback', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    const prompt = page.getByLabel('Original prompt', { exact: true });
    await prompt.fill('alpha background.\nbeta context.');
    await expect(page.getByLabel('Draft task focus')).toContainText('No credible task signal');
    await page.getByLabel('Task-focus policy', { exact: true }).selectOption('user');
    await prompt.fill('alpha background.\nchanged ending.');
    await expect(page.getByLabel('Draft task focus')).toContainText('no longer matches');
    await run(page);
    const [result] = await exportRuns(page);
    expect(result.taskFocus.policy).toBe('user');
    expect(result.taskFocus.fallback).toBe('legacy-final-chunk');
    await expect(page.getByLabel('Recorded result settings')).toContainText('fallback');
});

test('visible weight sliders change eligible selection with actual BPE', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Original prompt', { exact: true }).fill('ordinary background.\ncould you help?');
    await page.getByLabel('Task-focus policy', { exact: true }).selectOption('user');
    const choice = page.getByLabel('Original chunk for task focus', { exact: true });
    await choice.selectOption((await choice.locator('option').filter({ hasText: 'ordinary background' }).getAttribute('value'))!);
    await page.getByText('Experimental weighted objective', { exact: true }).click();
    for (const key of ['information', 'instruction', 'entity', 'structure', 'redundancy']) await page.getByRole('slider', { name: key, exact: true }).fill('0');
    await page.getByRole('slider', { name: 'Relevance (lexical)', exact: true }).fill('0.1');
    await page.getByLabel('Target retained', { exact: true }).fill('0.7');
    await page.getByLabel('Shaped-score cutoff', { exact: true }).fill('0.1');
    await run(page);
    await page.getByRole('slider', { name: 'instruction', exact: true }).fill('1');
    await expect(page.locator('.settings-changed')).toBeVisible();
    await run(page);
    const results = await exportRuns(page, true);
    expect(results).toHaveLength(2);
    expect(results[0].compressed.trim()).toBe('ordinary background.');
    expect(results[1].compressed.trim()).toBe('could you help?');
    expect(results.every(r => r.metrics.protectedTotal === 0 && r.budgetMet)).toBe(true);
    expect(results[1].settings.weights.instruction).toBe(1);
    expect(results[1].taskFocus.chunkId).toBe(results[0].taskFocus.chunkId);
    // Notebook selection restores recorded text while draft controls retain their latest values.
    await page.getByRole('tab', { name: 'Side by side' }).click();
    for (let i = 0; i < results.length; i++) {
        await page.locator('.history .table-link').nth(i).click();
        await expect(page.locator('.side-grid pre').nth(1)).toHaveText(results[i].compressed);
    }
});
