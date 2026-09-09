import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Run } from '../src/engine/types.js';
import { assertStudyControls } from '../src/engine/studies.js';

test('real embeddings measure transform study and independent budget ladder', async ({ page }, info) => {
    const errors: string[] = [], failures: string[] = [], externalBodies: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', r => failures.push(`${r.url().split('?')[0]}: ${r.failure()?.errorText}`));
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:') && (r.method() !== 'GET' || r.postData())) externalBodies.push(r.url()); });
    await page.goto('/'); await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.getByLabel('Load example').selectOption('math-study');
    await page.getByRole('button', { name: 'Download / enable local embeddings', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Local embeddings ready', { timeout: 240000 });
    await page.getByRole('button', { name: 'Compare math ↗', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Completed 7 transforms', { timeout: 120000 });
    await expect(page.locator('.study-learning')).toContainText('Similarity was measured for 7/7 runs');
    await page.locator('.study-presets > summary').click();
    await page.getByRole('button', { name: 'Compression vs preservation', exact: false }).click();
    await expect(page.locator('.statusbar')).toContainText('Compression vs preservation complete', { timeout: 120000 });
    await expect(page.locator('.study-learning')).toContainText('Similarity was measured for 4/4 runs');
    await expect(page.locator('.pareto .badge')).toHaveText('11 measured points');
    await page.getByLabel('Include prompt text in JSON').check();
    const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const runs: Run[] = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8')).experiments;
    assertStudyControls(runs.slice(0, 7), 'transforms'); assertStudyControls(runs.slice(7), 'ladder');
    for (const r of runs) {
        expect(r.similarityError).toBeNull();
        expect(r.similarity?.revision).toMatch(/^[a-f0-9]{40}$/);
        expect(r.similarity?.model).toBe('Xenova/all-MiniLM-L6-v2');
        expect(Number.isFinite(r.similarity?.cosine)).toBe(true);
        expect(r.decisions.filter(d => d.text.trim()).every(d => d.scoring?.relevanceMetric === 'embedding-cosine')).toBe(true);
        expect(r.decisions[0].scoring?.embeddingModel?.revision).toBe(r.similarity?.revision);
        expect(r.metrics.protectionRate).toBe(1);
    }
    expect(errors).toEqual([]); expect(failures).toEqual([]); expect(externalBodies).toEqual([]);
    await writeFile(info.outputPath('study-model-evidence.json'), JSON.stringify({ errors, failures, externalBodies,
        runs: runs.map(({ original: _a, compressed: _b, stages: _c, decisions, settings, taskFocus, ...r }) => ({ ...r,
            settings: { ...settings, protectedTerms: [] }, taskFocus: { ...taskFocus, text: undefined },
            decisions: decisions.map(({ text: _text, ...d }) => d) })) }, null, 2));
});
