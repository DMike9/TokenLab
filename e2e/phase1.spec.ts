import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

async function downloadJson(page: Page) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}
async function run(page: Page, method = 'Importance + math') {
    await page.locator('.method-card').filter({ hasText: method }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
}

test('custom protection invalidates analyzed spans and a run refreshes them', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Original prompt', { exact: true }).fill('ordinary background. rare phrase.');
    await page.getByRole('button', { name: 'Analyze prompt', exact: false }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
    const count = page.locator('.input-metrics > div').last().locator('strong');
    await expect(count).toHaveText('0');
    await page.locator('.protection-panel summary').click();
    await page.getByLabel('Additional exact strings to protect (one per line)').fill('rare phrase');
    await expect(count).not.toHaveText('0');
    await page.getByRole('button', { name: 'Analyze prompt', exact: false }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
    await expect(count).toHaveText('1');
    await page.getByLabel('Additional exact strings to protect (one per line)').fill('');
    await page.locator('.method-card').filter({ hasText: 'Structural minify' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(count).toHaveText('0');
});

for (const width of [1440, 390]) test(`Explore guides use real results and preserve Research access at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Explore', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Run all 7 transforms against this prompt' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Experiment notebook' })).toBeHidden();
    await page.screenshot({ path: info.outputPath(`explore-${width}.png`) });
    await page.getByRole('button', { name: /Remove obvious redundancy/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(page.locator('.diff-removed').first()).toBeVisible();
    await expect(page.getByLabel('Recorded result settings')).toContainText('Redundancy');
    await expect(page.locator('.task-result')).toContainText('Not evaluated');
    await expect(page.locator('.result-metrics')).toContainText('Not measured. Enable local embeddings');
    await page.getByRole('button', { name: /Protect a critical instruction/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await page.getByRole('tab', { name: 'Side by side' }).click();
    await expect(page.locator('.side-grid pre').nth(1)).toContainText('Do NOT delete the database.');
    await expect(page.locator('.side-grid pre').nth(1).locator('mark').filter({ hasText: 'Do NOT delete the database.' })).toBeVisible();
    await page.getByRole('button', { name: /Try an infeasible budget/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(page.getByLabel('Recorded result settings')).toContainText('10% retained');
    await expect(page.locator('.result-explanation')).toContainText('Target budget not met');
    await expect(page.locator('.statusbar')).not.toHaveClass(/has-error/);
    await expect(page.locator('.settings-changed')).toHaveCount(0);
    await page.locator('.results').screenshot({ path: info.outputPath(`result-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const text = await page.getByLabel('Original prompt', { exact: true }).inputValue();
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await expect(page.getByLabel('Original prompt', { exact: true })).toHaveValue(text);
    await expect(page.locator('.method-card')).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'Run all 7 transforms against this prompt' })).toBeVisible();
    await expect(page.locator('.history tbody tr')).toHaveCount(2);
    await expect(page.locator('.arena summary')).toBeVisible();
    await expect(page.locator('.protection-panel summary')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download / enable local embeddings' })).toBeVisible();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.getByLabel('Recorded result settings')).toContainText('10% retained');
    expect(errors).toEqual([]);
});

test('recorded result survives draft settings and tokenizer edits until rerun', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Load example').selectOption('negation');
    await run(page);
    const context = page.getByLabel('Recorded result settings');
    const recorded = await context.innerText();
    const metrics = await page.locator('.result-metrics').innerText();
    await page.getByRole('slider', { name: 'Target retained', exact: true }).fill('0.1');
    await page.getByRole('slider', { name: 'Shaped-score cutoff', exact: true }).fill('0.8');
    await expect(page.locator('.settings-changed')).toHaveText('Settings changed — run again to update the result.');
    expect(await context.innerText()).toBe(recorded);
    expect(await page.locator('.result-metrics').innerText()).toBe(metrics);
    expect((await downloadJson(page)).experiments[0].settings.budget).toBe(.65);
    await page.getByLabel('Tokenizer encoding').selectOption('cl100k_base');
    await expect(context).toContainText('o200k_base');
    await expect(page.locator('.history tbody tr')).toHaveCount(0);
    await page.getByRole('button', { name: /Analyze prompt/ }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
    await page.getByRole('tab', { name: 'Original tokens' }).click();
    await page.getByRole('button', { name: 'Load tokens for this result' }).click();
    await expect(page.locator('.token-inspector')).toBeVisible();
    await expect(context).toContainText('o200k_base');
    expect(await page.locator('.result-metrics').innerText()).toBe(metrics);
    await run(page);
    await expect(context).toContainText('cl100k_base');
    await expect(context).toContainText('10% retained');
    await expect(context).toContainText('0.8');
    await expect(page.locator('.settings-changed')).toHaveCount(0);
    const latest = (await downloadJson(page)).experiments[0];
    expect(latest.settings).toMatchObject({ encoding: 'cl100k_base', budget: .1, cutoff: .8 });
    await page.getByText('Chain operations', { exact: true }).click();
    await page.getByLabel('Use ordered pipeline on Run experiment').check();
    await expect(page.locator('.settings-changed')).toBeVisible();
    await page.getByRole('button', { name: /Run pipeline/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(context).toContainText('Structural minify → Redundancy → Lexical rewrite → Importance + math');
    await expect(context).toContainText('each budgeted stage');
    await expect(page.locator('.settings-changed')).toHaveCount(0);
});

test('export scope is explicit and redacted by default for both scopes and formats', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await run(page, 'Baseline');
    await page.getByLabel('Tokenizer encoding').selectOption('cl100k_base');
    await run(page, 'Baseline');
    await page.getByLabel('Load example').selectOption('negation');
    await run(page, 'Baseline');
    await expect(page.getByLabel('Include prompt text in JSON')).not.toBeChecked();
    for (const [scope, count] of [['current', 1], ['session', 3]] as const) {
        await page.getByLabel('Export scope').selectOption(scope);
        const data = await downloadJson(page);
        expect(data.experiments).toHaveLength(count);
        expect(data.exportScope).toBe(scope === 'current' ? 'current-prompt-and-encoding' : 'full-session');
        for (const row of data.experiments) {
            expect(row).not.toHaveProperty('original');
            expect(row).not.toHaveProperty('compressed');
            expect(row.settings.protectedTerms).toEqual([]);
        }
        const pending = page.waitForEvent('download');
        await page.getByRole('button', { name: 'CSV', exact: true }).click();
        expect((await readFile((await (await pending).path())!, 'utf8')).split('\r\n')).toHaveLength(count + 1);
    }
    await page.getByLabel('Include prompt text in JSON').check();
    await page.getByLabel('Export scope').selectOption('current');
    expect((await downloadJson(page)).experiments[0].original).toContain('Do NOT delete the database.');
});

test('accessible result tabs support arrows, Home, End and Tab on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Remove obvious redundancy/ }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    const first = page.getByRole('tab', { name: 'Visual diff' });
    await first.focus();
    await expect(first).toHaveCSS('outline-style', 'solid');
    await first.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Side by side' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Side by side' })).toBeVisible();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Original tokens' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Original tokens' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tabpanel', { name: 'Visual diff' })).toBeFocused();
    expect(await page.getByRole('tab').evaluateAll(tabs => tabs.filter(t => t.getAttribute('tabindex') === '0').length)).toBe(1);
    expect(await page.getByRole('tab').evaluateAll(tabs => tabs.every(t => {
        const panel = document.getElementById(t.getAttribute('aria-controls')!);
        return panel?.getAttribute('aria-labelledby') === t.id;
    }))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('zero savings, protected JSON and unavailable similarity are explanatory states', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await run(page, 'Baseline');
    await expect(page.locator('.result-explanation')).toContainText('Zero savings is expected');
    await expect(page.getByLabel('Recorded result settings')).toContainText('Not applied by this method');
    await expect(page.locator('.method-card').filter({ hasText: 'Similarity guard' })).toBeDisabled();
    await expect(page.locator('.result-metrics')).toContainText('Not measured. Enable local embeddings');
    await page.getByLabel('Load example').selectOption('json');
    await run(page);
    await expect(page.locator('.result-explanation').first()).toContainText('valid JSON is protected verbatim');
    await expect(page.locator('.result-explanation').last()).toContainText('Target budget not met');
    await expect(page.locator('.statusbar')).not.toHaveClass(/has-error/);
    await page.getByLabel('Original prompt', { exact: true }).fill('simple context.');
    await run(page, 'Structural minify');
    await expect(page.locator('.result-explanation')).toContainText('no token reduction within its rules');
});
