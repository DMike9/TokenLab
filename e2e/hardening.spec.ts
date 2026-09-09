import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function research(page: Page) {
    await page.goto('/'); await page.getByRole('button', { name: 'Research', exact: true }).click();
}
async function exported(page: Page) {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
}

// Explicit transport fault seam. Real engine messages pass through; only timing/faults are injected.
async function delayedWorker(page: Page) {
    await page.addInitScript(() => {
        const RealWorker = window.Worker;
        class DelayedWorker {
            onmessage: ((event: MessageEvent) => void) | null = null;
            onerror: ((event: ErrorEvent) => void) | null = null;
            onmessageerror: (() => void) | null = null;
            inner: Worker;
            lastId = 0;
            constructor(url: string | URL, options?: WorkerOptions) {
                this.inner = new RealWorker(url, options);
                this.inner.onmessage = event => { setTimeout(() => this.onmessage?.(event), 180); };
                this.inner.onerror = event => this.onerror?.(event);
                (window as unknown as { fault: () => void }).fault = () => this.onerror?.(new ErrorEvent('error', { message: 'Injected worker failure' }));
            }
            postMessage(message: { id: number; action: string }) {
                this.lastId = message.id;
                if (message.action === 'embeddings') {
                    // Deterministic cancellation while initialization is outstanding, not real model evidence.
                    setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: { id: message.id, result: true } })), 1500);
                } else this.inner.postMessage(message);
            }
            terminate() {
                this.inner.terminate();
                setTimeout(() => {
                    this.onmessage?.(new MessageEvent('message', { data: { id: this.lastId, progress: 'STALE progress must not win' } }));
                    this.onerror?.(new ErrorEvent('error', { message: 'STALE error must not kill replacement' }));
                }, 300);
            }
        }
        window.Worker = DelayedWorker as unknown as typeof Worker;
    });
}
test('rapid clicks, cancel, clear and late worker responses cannot overwrite new intent', async ({ page }) => {
    await delayedWorker(page); await research(page);
    const run = page.locator('.method-card').filter({ hasText: 'Baseline' });
    await run.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
    await expect(page.getByLabel('Load example')).toBeDisabled();
    await expect(page.getByRole('slider', { name: 'Target retained', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByLabel('Original prompt', { exact: true }).fill('new intent after cancellation');
    await run.click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(page.locator('.history tbody tr')).toHaveCount(1);
    expect((await exported(page)).experiments).toHaveLength(1);
    await page.getByRole('button', { name: 'Download / enable local embeddings', exact: true }).click();
    await page.getByRole('button', { name: 'Clear prompt and session' }).click();
    await expect(page.locator('.statusbar')).toContainText('cleared');
    await page.getByLabel('Original prompt', { exact: true }).fill('final intent'); await run.click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    // Wait beyond the injected model response by starting another real serialized operation.
    await page.getByRole('button', { name: /Analyze prompt/ }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
    await expect(page.getByRole('button', { name: 'Download / enable local embeddings', exact: true })).toBeVisible();
    expect((await exported(page)).experiments[0].settings.useEmbeddings).toBe(false);
});
test('worker error is visible; restart succeeds without old error/progress', async ({ page }) => {
    await delayedWorker(page); await research(page);
    await page.getByRole('button', { name: 'Download / enable local embeddings', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Local embeddings ready');
    await page.locator('.method-card').filter({ hasText: 'Baseline' }).click();
    await page.evaluate(() => (window as unknown as { fault: () => void }).fault());
    await expect(page.locator('.statusbar')).toContainText('Injected worker failure');
    await expect(page.getByRole('button', { name: 'Download / enable local embeddings', exact: true })).toBeVisible();
    await page.locator('.method-card').filter({ hasText: 'Baseline' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await expect(page.locator('.history tbody tr')).toHaveCount(1);
});
test('model download failure is explicit and a keyless run remains available', async ({ page, context }) => {
    await context.route('https://huggingface.co/**', route => route.abort('failed'));
    await research(page);
    await page.getByRole('button', { name: 'Download / enable local embeddings', exact: true }).click();
    await expect(page.locator('.statusbar')).toHaveClass(/has-error/, { timeout: 30000 });
    await expect(page.locator('.method-card').filter({ hasText: 'Similarity guard' })).toBeDisabled();
    await page.locator('.method-card').filter({ hasText: 'Baseline' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    expect((await exported(page)).experiments[0].similarity).toBeNull();
});
test('XSS text, inspector pages, keyboard controls and clear resets text-export opt-in', async ({ page }) => {
    const remote: string[] = []; page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:5173')) remote.push(r.url()); });
    await research(page);
    const text = '<img src=x onerror="window.pwned=1">\n' + ' x'.repeat(2001) + '\n🌱\u0001';
    await page.getByLabel('Original prompt', { exact: true }).fill(text);
    await page.locator('.method-card').filter({ hasText: 'Baseline' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    const tab = page.getByRole('tab', { name: 'Visual diff' }); await tab.focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Original tokens' })).toBeFocused();
    const next = page.getByRole('button', { name: 'Next token page' }); await next.focus(); await page.keyboard.press('Space');
    await expect(page.locator('.token-inspector')).toContainText('Showing 121');
    for (let i = 1; i < 16; i++) await next.click();
    await expect(next).toBeDisabled();
    await page.locator('.token-cloud button').last().click();
    await expect(page.locator('.token-detail')).toContainText('1999 /');
    await expect(page.locator('.token-detail')).toContainText('outside inspection cap');
    expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
    expect(remote).toEqual([]);
    await page.getByLabel('Include prompt text in JSON').check();
    await page.getByRole('button', { name: 'Clear prompt and session' }).click();
    await expect(page.getByLabel('Include prompt text in JSON')).not.toBeChecked();
});
test('oversize paste is visibly rejected without silently truncating the prompt', async ({ page, context }) => {
    await research(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const prompt = page.getByLabel('Original prompt', { exact: true });
    const prior = await prompt.inputValue();
    await page.evaluate(() => navigator.clipboard.writeText('x'.repeat(60001)));
    await prompt.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+V');
    await expect(prompt).toHaveValue(prior);
    await expect(page.locator('.statusbar')).toContainText('Prompt unchanged');
    await page.evaluate(() => navigator.clipboard.writeText('1\n'.repeat(30000)));
    await prompt.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+V');
    await expect(prompt).toHaveValue('1\n'.repeat(30000));
    await page.getByRole('button', { name: /Analyze prompt/ }).click();
    await expect(page.locator('.statusbar')).toContainText('analyzed');
});
test('200 percent content zoom retains reachable controls and no page-wide overflow', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await research(page);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.locator('.method-card').filter({ hasText: 'Baseline' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await page.getByRole('tab', { name: 'Visual diff' }).focus(); await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Original tokens' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('zoom-200.png') });
});
for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844]]) test(`hardening rendering ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await research(page);
    const text = 'Summarize the orchard risk.\n' + 'https://example.test/' + 'long'.repeat(100) + '\nordinary context.\n```ts\nconst exampleIdentifier = "' + 'x'.repeat(200) + '";\n```';
    await page.getByLabel('Original prompt', { exact: true }).fill(text);
    await page.locator('.method-card').filter({ hasText: 'Weighted hybrid' }).click();
    await expect(page.locator('.statusbar')).toContainText('complete');
    await page.locator('.score-details').first().locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('.results').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`hardening-${width}.png`) });
    await page.getByRole('tab', { name: 'Side by side' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
