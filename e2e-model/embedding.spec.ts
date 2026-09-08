import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Run } from '../src/engine/types.js';

test('real public model downloads and browser-worker inference', async ({ page }, info) => {
    const errors: string[] = [], network: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => network.push(`${r.url().split('?')[0]}: ${r.failure()?.errorText}`));
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByRole('button', { name: 'Download / enable local embeddings', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Local embeddings ready', { timeout: 240000 });
    for (const [example, method] of [['long', 'Redundancy'], ['negation', 'Similarity guard'], ['redundancy', 'Weighted hybrid']]) {
        await page.getByLabel('Load example').selectOption(example);
        await page.locator('.method-card').filter({ hasText: method }).click();
        await expect(page.locator('.statusbar')).toContainText('complete', { timeout: 120000 });
        await expect(page.getByLabel('Recorded result settings')).toContainText('Xenova/all-MiniLM-L6-v2');
        if (method === 'Similarity guard') await expect(page.getByLabel('Recorded result settings')).toContainText('0.95 cosine');
    }
    await page.getByLabel('Export scope').selectOption('session');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const exported = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
    for (const run of exported.experiments as Run[]) {
        expect(run.similarityError).toBeNull();
        expect(run.similarity?.model).toBe('Xenova/all-MiniLM-L6-v2');
        expect(run.similarity?.revision).toMatch(/^[a-f0-9]{40}$/);
        expect(Number.isFinite(run.similarity?.cosine)).toBe(true);
    }
    expect(exported.experiments[0].similarity.originalChunks).toBeGreaterThan(1);
    expect(exported.experiments[1].similarity.cosine).toBeGreaterThanOrEqual(.95 - 1e-10);
    await expect(page.getByLabel('Recorded result settings')).toContainText(exported.experiments.at(-1).similarity.revision);
    const measured = await page.locator('.result-metrics').innerText();
    await page.getByRole('button', { name: /Enabled · disable for new runs/ }).click();
    await expect(page.locator('.settings-changed')).toBeVisible();
    expect(await page.locator('.result-metrics').innerText()).toBe(measured);
    await expect(page.locator('.pareto svg')).toBeVisible();
    await page.locator('.results').screenshot({ path: info.outputPath('embedding-results.png') });
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    await writeFile(info.outputPath('embedding-evidence.json'), JSON.stringify({ exported, errors, network }, null, 2));
});

test('long Unicode tails affect real worker embeddings beyond the first window', async ({ page }, info) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    // Exercise the same real embedding implementation in a fresh module worker. The common
    // prefix exceeds one model window; a score computed only on that prefix would be identical.
    const tails = await page.evaluate(async () => {
        const source = `
            import { initializeEmbeddings, embedText, modelRevision } from '${location.origin}/src/similarity/embedding.ts';
            try {
                await initializeEmbeddings(() => {});
                const prefix = 'Routine planning and team coordination. '.repeat(100);
                const a = await embedText(prefix + 'Flowers bloom in the garden. café 🌱 中文 👩🏽‍💻 '.repeat(100));
                const b = await embedText(prefix + 'Database replication and network security. '.repeat(100));
                self.postMessage({ revision: modelRevision(), a, b });
            } catch (e) { self.postMessage({ error: String(e) }); }
        `;
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        const worker = new Worker(url, { type: 'module' });
        try {
            return await new Promise<{ error?: string; revision: string; a: { vector: number[]; chunks: number }; b: { vector: number[]; chunks: number } }>((resolve, reject) => {
                worker.onmessage = event => resolve(event.data);
                worker.onerror = event => reject(new Error(event.message));
            });
        } finally { worker.terminate(); URL.revokeObjectURL(url); }
    });
    expect(tails.error).toBeUndefined();
    expect(tails.a.chunks).toBeGreaterThan(1);
    expect(tails.b.chunks).toBeGreaterThan(1);
    expect(tails.a.vector).toHaveLength(384);
    const cosine = tails.a.vector.reduce((sum, v, i) => sum + v * tails.b.vector[i], 0);
    expect(cosine).toBeLessThan(.99);
    await writeFile(info.outputPath('tail-evidence.json'), JSON.stringify({ revision: tails.revision, aChunks: tails.a.chunks, bChunks: tails.b.chunks, cosine }, null, 2));
});
