import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const engine = readdirSync('src/engine').filter(f => f.endsWith('.ts') && f !== 'runner.ts').map(f => join('src/engine', f));
const args = ['--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', '--outDir', '.core-check', '--rootDir', '.', ...engine, 'tests/scenarios.ts'];
const compiled = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', ...args], { stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status || 1);
const { scenarios } = await import('../.core-check/tests/scenarios.js');
let failed = 0;
for (const scenario of scenarios) {
 try { await scenario.run(); console.log(`PASS ${scenario.name}`); }
 catch (error) { failed++; console.error(`FAIL ${scenario.name}\n${error.stack}`); }
}
console.log(`\n${scenarios.length - failed}/${scenarios.length} pure engine checks passed. These do not validate installed BPE/model/browser dependencies.`);
rmSync('.core-check', { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
