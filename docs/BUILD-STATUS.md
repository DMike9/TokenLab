# Build status: locally verified development build

## Hardening Gate ? Post Phase 2 ? 2026-09-09

**PASS for the experimental local application; commit-ready.** Twelve findings repaired (0 Critical, 2 High, 5 Medium, 5 Low); no unresolved Critical/High defect found in reviewed paths. Full findings, reproductions, residual limits and mutation evidence: [HARDENING-REPORT](HARDENING-REPORT.md). This is not Phase 3 or downstream research validation.

| Command actually executed | Result |
| --- | --- |
| `npm ci` | Clean install passed: 109 packages added, 110 audited. An intermediate attempt hit EPERM because the local dev server held esbuild.exe; stopped this workspace's process and reran successfully. |
| `npm audit --json`, initial / `npm install` | Initial two High entries through sharp; patched existing override 0.35.3?0.35.4 and regenerated its lock graph. No major upgrade. |
| `npm run verify`, final | Strict TypeScript; **202/202 Vitest**; **20/20 mocked gateway**; production build, **49 modules**, 6.29 s. |
| `npm run check:core` | **71/71** pure-engine contracts; character counters remain test seams. |
| `npx playwright install chromium` | Successful; installed Chromium available for actual browser runs. |
| `npm run test:e2e`, final | **26/26 passed**, 54.4 s, including nine hardening browser cases plus prior flows and all nine examples/63 experiments. |
| `npm run test:model`, final | **3/3 passed**, 24.0 s, real downloads/local inference, finite normalized vectors, Unicode long tails, focus policies and keyboard chart selection. |
| `npm run preview` | Served the actual production bundle at `http://127.0.0.1:4173/`. |
| `$env:TOKENLAB_TEST_URL = 'http://127.0.0.1:4173'; npm run test:model -- --grep 'real public'` | **1/1 passed**, 9.2s, against the final production build; long example, similarity guard, hybrid, recorded model metadata and export. |
| `npm audit`, final | **0 vulnerabilities**. |
| `.cache/tiktoken-venv/Scripts/python.exe scripts/generate-hardening-fixture.py` | Generated 12 targeted independent tiktoken **0.14.0** fixtures. Together with 36 existing fixtures, exact IDs/decodes pass for all three encodings. |
| `npm test -- tests/hardening.test.ts`, before/after repairs | Initially **7 failed / 5 passed**; final expanded suite is included in the 202 passing tests. No original tests removed or relaxed. |
| `npm test -- tests/limits.test.ts` | Boundary checks passed; final suite also includes dense 60,000-code-unit protection reconstruction. |
| `python .cache/mutate-hardening.py` | **7/7 mutations detected**; every source file restored byte-for-byte; final suites pass. Temporary helper is ignored. |
| `node .cache/stress-chunks.mjs` | Dense 30,000-line chunking: local 5,795 ms before / 22.6 ms after. Local observation, not a benchmark. |
| `node .cache/check-sharp-hardening.mjs` | sharp 0.35.4/libvips 8.18.6 successfully produced an 89-byte synthetic PNG; dependency smoke only. |
| `git ls-remote` against six official Actions repos/tags | Verified same-major release SHAs; pinned workflows. Exact tag/SHA table in the report. |
| `python .cache/audit-public.py` | Public tracked/new-file credential-pattern/path audit and both workflow YAML/permission/pin checks passed. Secret files were excluded without opening their contents. |
| `git diff --check` | Passed; only existing Windows line-ending notices. |

Real model: **Xenova/all-MiniLM-L6-v2**, **751bff37182d3f1213fa05d7196b954e230abad9**, q8/WASM, Transformers.js 3.8.1. Full-input tail cases used **7/5 windows**, cosine **0.5246208440170577**; this is an embedding proxy, not task-performance evidence. [Compact evidence](verification/hardening/evidence.json).

Actual screenshots inspected: [1440?1000](verification/hardening/results-1440.png), [1024?768](verification/hardening/results-1024.png), [390?844](verification/hardening/results-390.png), [200% content zoom](verification/hardening/zoom-200.png). No page-wide overflow in these checks. The in-app browser connection returned `missing field sandboxPolicy`; installed Playwright Chromium supplied the evidence. Native browser-chrome zoom and manual screen readers were not tested. One redundant concurrent model rerun was interrupted when its test-owned server exited; the final suites ran against a stable separately started development server.

No secrets inspected, Gemini calls, commit, push or deployment. Review the local diff and commit the intended source/tests/docs/lockfile together. Live Gemini, deployment, other browsers/devices, offline first use and full accessibility conformance remain unverified. All sections below are **dated historical results**, not current counts or dependency status.

## Phase 2 — Task focus and interpretable importance — 2026-09-08

**COMPLETE; ready for human commit/push.** Auto/user-selected/legacy original-prompt focus, separate hard protection and soft features, contribution inspection, notebook comparison and schema-2 exports are implemented. Full audit, failure history, decisions and limitations: [Phase 2 implementation log](IMPLEMENTATION-LOG.md#phase-2--task-focus-and-interpretable-importance).

| Command actually run | Actual result |
| --- | --- |
| `npm test -- tests/scoring-audit.test.ts`, before production changes | **7/7 passed** after correcting fixture assumptions about chunk boundaries. |
| `npm run verify`, final | Passed strict TypeScript, **164/164 unit/integration tests**, **14/14 mocked gateway tests**, and production build (49 modules; 9.40 s). |
| `npm run check:core` | **71/71 passed**. These counters remain pure-engine test seams. |
| `npm run test:e2e`, final | **17/17 passed** (55.0 s); includes all Phase 1 regressions, nine-example/63-experiment BPE checks, task-focus comparison, safe redaction, visible weight sliders and recorded notebook restoration. |
| `npm run test:model` | **3/3 passed** (50.3 s): real browser-worker inference, full long Unicode inputs and all three focus policies with actual embedding relevance. |
| `npm audit` | **0 vulnerabilities**. Dependencies and lockfile unchanged. |
| `node .cache/capture-phase2.mjs` | Actual desktop/mobile Chromium captures; no page-wide overflow at 1440×1000 or 390×844. |
| `git diff --exit-code -- package.json package-lock.json src/engine/protection.ts .github` / `git diff --check` | Unchanged dependencies, hard detector and workflows / clean diff formatting (existing Windows normalization notices only). |
| HTTP GET `http://127.0.0.1:5173/` | **200**, existing Vite server; project remains runnable with `npm run dev`. |

Inspected the desktop/mobile controls, results and notebook. The curated public set retains [desktop Research](verification/phase2/research-1440.png), [mobile contributions](verification/phase2/scores-390.png), and the distinct [policy-comparison notebook](verification/phase2/notebook-1440.png); model results remain in compact measurement evidence below. Phase 2 browser instrumentation recorded no page/console errors; model tests recorded no failed requests. The in-app browser bootstrap remained unavailable (`missing field sandboxPolicy`); installed Playwright Chromium provided the evidence.

Model **Xenova/all-MiniLM-L6-v2**, q8/WASM, revision **751bff37182d3f1213fa05d7196b954e230abad9**. [Actual focus/model measurements](verification/phase2/focus-embedding-evidence.json) record Auto/user-first-chunk output at 30 tokens and Legacy at 21 (49 original), with cosine 0.9693 and 0.8390 respectively. These do not establish task correctness or a globally better policy. [Long-tail measurements](verification/phase2/tail-evidence.json) retain 7/5 windows and cosine 0.5246208440170577.

No functional Phase 2 blocker remains in tested Chromium. Auto/soft features are incomplete English heuristics; hard protection can make budgets infeasible. Legacy exposes the old anchor rule, not the entire previous scorer. No physical-device, other-browser, screen-reader or deployed-subpath check is claimed. No live Gemini calls, secrets inspection, dependency changes, push, deployment or Phase 3 work occurred. Earlier sections below are historical evidence.

## Dependabot maintenance — 2026-09-08

Configuration/documentation-only cleanup: weekly grouped minor/patch updates for npm and Actions, with routine majors deferred and security updates still eligible. Application dependencies and workflows are unchanged. This pass ran `npm audit --json` (0 vulnerabilities), `npm run verify` (strict TypeScript, 140 unit tests, 14 mocked gateway tests, production build passed), `npm run check:core` (71 passed), YAML validation against the downloaded Dependabot JSON Schema (passed), and `git diff --check` (passed). Browser/model suites were not rerun in this pass. See [the implementation log](IMPLEMENTATION-LOG.md#2026-09-08-dependabot-cleanup) for all ten PR dispositions, actual remote CI evidence, exact validation commands and remaining settings/Actions risks. No push, deployment or live Gemini calls.

## Phase 1 update — September 8, 2026

**First-time UX and result clarity: COMPLETE; commit-ready.** Full change list, decisions, failure history and limitations: [IMPLEMENTATION-LOG](IMPLEMENTATION-LOG.md).

| Command actually run in this phase | Actual result |
| --- | --- |
| `npm run verify` | Passed: strict TypeScript, **140/140 unit tests**, **14/14 mocked gateway tests**, production build (46 modules). No live Google calls. |
| `npm run check:core` | **71/71 passed**. |
| `npm run test:e2e` | **13/13 passed**, including seven new Phase 1 tests and all prior browser checks. |
| `npm run test:e2e -- e2e/phase1.spec.ts` | Initial protection regression **failed before the fix** (count stayed 0), then passed. Final expanded focused suite: **7/7 passed**. An intermediate tab-focus failure was fixed with a visible focus style, retaining assertions. |
| `npm run test:model` | **2/2 passed** with real browser embeddings, recorded model/floor/revision display, immutable measurements after disabling embeddings, and long Unicode inputs. [Measurements](verification/phase1/embedding-evidence.json). |
| `npm audit` / `git diff --check` | **0 vulnerabilities** / passed. Dependencies unchanged. |
| `npm run dev` / HTTP check | New start reported occupied port 5173; reused existing Vite server. **HTTP 200** at **http://127.0.0.1:5173/**. |

Inspected real screenshots: [Explore desktop](verification/phase1/explore-desktop.png), [Explore mobile](verification/phase1/explore-mobile.png), [desktop result](verification/phase1/result-desktop.png), [mobile result](verification/phase1/result-mobile.png), [model result](verification/phase1/embedding-results.png). Desktop 1440×1000 and mobile 390×844; no page-wide mobile overflow. Guided/example browser checks recorded no page/console errors. In-app browser setup remains unavailable (`missing field sandboxPolicy`); Playwright Chromium was used successfully.

No Phase 1 functional blocker remains. No manual screen-reader, physical-device or other-browser checks were performed. This phase's changed UI was browser-tested on the development server; no new preview/deployment check is claimed. No Gemini process, paid API call, push or deployment was performed. The prior verification below is retained as historical evidence.

## Initial local integration verification (before Phase 1)

Verified September 8, 2026 in this Windows workspace with Node **24.15.0**, npm **11.12.1**, Python **3.13.14** (fixture generation only), and Playwright **1.63.0 / Chromium 153.0.8010.12**. No Gemini key was inspected, no paid calls were made, and nothing was published or deployed.

Initial integration established the repository with verified source, lockfile, tests and evidence. Secrets, dependencies, model caches and build output are excluded.

## Commands actually executed

| Command | Actual result |
| --- | --- |
| `npm install` | Successful; generated a real `package-lock.json`. Initial audit reported two high-severity entries through sharp. Reinstalled after the targeted override below. |
| `npm ci` | Successful clean installation from the lockfile: 109 packages added, 110 audited, zero vulnerabilities. |
| `npm run verify` | **Passed after clean install:** strict TypeScript (including browser test sources), **140/140 Vitest tests**, **14/14 mocked gateway tests**, and Vite production build. [Output](verification/verify.txt). |
| `npm run check:core` | **71/71 passed** after clean install. These deliberately use a character-count seam, not a BPE tokenizer. [Output](verification/core.txt). |
| `npx playwright install chromium` | Downloaded Chromium and Chromium headless shell successfully. |
| `npm run test:e2e` | **6/6 passed** after clean install. [Output](verification/e2e.txt). |
| `python -m venv .cache/tiktoken-venv` | Successful workspace-local Python environment. |
| `./.cache/tiktoken-venv/Scripts/python -m pip install tiktoken` | Installed independent Python **tiktoken 0.14.0**. |
| `./.cache/tiktoken-venv/Scripts/python scripts/generate-tiktoken-fixture.py` | Generated **36** exact-token-ID fixtures. All pass against installed gpt-tokenizer 4.0.0 in Vitest. |
| `npm run test:model` | **2/2 passed** after clean install, using real public downloads and real browser-worker inference. [Output](verification/model.txt), [measurements](verification/development-embedding.json), [long-tail check](verification/embedding-tail.json). Separate from ordinary CI; no Gemini calls. |
| `npm run preview` | Production bundle served on **http://127.0.0.1:4173/** during verification. |
| `$env:TOKENLAB_TEST_URL = 'http://127.0.0.1:4173'; npm run test:model -- --grep 'real public'` | **1/1 passed** against the production bundle, including model loading, WASM, worker inference, and measured exports. [Measurements](verification/production-embedding.json). Preview was then stopped. |
| `npm audit` | **Zero vulnerabilities** after the override and clean installation. |
| `node .cache/sharp-check.mjs` | Native dependency smoke check: sharp **0.35.3**, libvips **8.18.3**, generated a 97-byte PNG from a synthetic 2×2 input. This is a dependency check, not an application screenshot. |
| `npm run dev` | Running at **http://127.0.0.1:5173/**. Restart with this command if the terminal closes. |

## Repairs made and initial failures

- The first `npm run verify` failed with **TS2590** at the Transformers.js pipeline call. Explicitly specializing the installed generic API to `pipeline<'feature-extraction'>` fixes inference complexity while retaining the real pipeline types and strict checking.
- The first browser suite had **1 failure / 2 passes**: Vite discovered worker-only dependencies on first analysis, re-optimized, and reloaded the page, erasing session state. Explicit `optimizeDeps.include` entries preload those dependencies. The complete browser suite passed again following `npm ci`, which removed the old optimization cache.
- The audit identified [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) in sharp, inherited through Transformers.js. A scoped override selects **sharp 0.35.3**, which packages patched libvips 8.18.3. No forced blanket or Transformers.js major upgrade was used. Native loading/image output and the actual browser text-model path both passed. npm labels three installed optional platform descendants (`@img/sharp-wasm32`, `@emnapi/runtime`, `tslib`) extraneous even after `npm ci`; they are present in the lockfile and do not prevent checks or auditing.
- The pure-engine script now invokes the installed TypeScript entry point using Node directly, removing Windows shell argument handling and its Node deprecation warning.
- New test development caught an ambiguous slider locator, a redacted-export TypeScript narrowing error, and a relative import in the temporary model-test Blob worker. These were corrected in the test harness; no protection, budget or similarity assertions were removed or relaxed.
- In-app browser automation could not bootstrap because its tool returned `missing field sandboxPolicy`. Inspection used the installed Playwright Chromium fallback and actual application screenshots. No screenshots were generated or mocked.

The source-authoring environment's original 71 core / 14 gateway results remain in [verification-output.txt](verification-output.txt) as historical evidence; dependency/network blocks from that environment no longer apply here. Playwright's inherited NO_COLOR/FORCE_COLOR warning appears in the retained logs and is not a browser console error.

## Browser and tokenizer coverage

The expanded browser suite executes **all eight example prompts through all seven methods that do not require embeddings** (56 experiments). It checks whole-result BPE counts, non-expansion, detected protected-occurrence retention, baseline identity, and feasible budget bounds. Additional flows check all seven transform buttons and the sweep, temperature/cutoff/sigmoid controls, impossible protected budgets, four-stage chain continuity, notebook isolation, Unicode and token selection in all three encodings, duplicate manually protected phrases, lossless reconstruction from the visual diff, JSON text opt-in/redaction, CSV downloads, and session clearing. Gemini controls remain opt-in and disabled without authorization. Runtime and console errors were absent in the instrumented example sweep.

The independent fixtures cover **o200k_base, cl100k_base, r50k_base** with empty text, punctuation, multilingual scripts, emoji/ZWJ, combining marks, control characters, whitespace, code/JSON/numbers, literal special-token-looking strings, and a 24,000-character input. Every token ID and decoded string matched Python tiktoken. This establishes parity for these fixtures, not exhaustive parity for every possible string or chat-request format.

Real screenshots were inspected at **1440×1000 desktop** and **390×844 mobile**, including mobile results. No page-wide mobile overflow was measured. Fixed status bars and internal scrolling remain intentional UI behavior.

- [Desktop viewport](verification/desktop-top.png) / [full desktop page](verification/desktop.png)
- [Mobile viewport](verification/mobile-top.png) / [mobile results](verification/mobile-results.png)
- [Production embedding results](verification/production-embedding.png)

## Real model evidence

Model: **Xenova/all-MiniLM-L6-v2**, revision **751bff37182d3f1213fa05d7196b954e230abad9**, **q8 / WASM**, Transformers.js **3.8.1**. The revision was resolved from actual public model metadata and recorded in the exported measurements. No download, CORS, ONNX, worker, or browser-console errors were recorded by the UI model tests in development or production.

The real UI exercised the long example with redundancy compression, the negation example with Similarity guard at a 0.95 floor, and redundancy with embedding-enabled Weighted hybrid. Each export contained finite named-model measurements with the resolved revision. The long example used multiple embedding windows; the semantic-floor assertion passed. The Pareto chart displayed measured points.

An additional real module-worker test used an identical 100-sentence prefix followed by different long tails, including accented text, Chinese and emoji/ZWJ. The full strings produced **7 and 5 windows**, **384-dimensional vectors**, and cosine **0.5246208440170577**. Thus text beyond the first window materially changed the vector. The implementation traverses original code points and explicitly checks each admitted window against 254 content tokens; it throws beyond its 128-window limit rather than returning a truncated score. Weighted whole-document pooling remains an experimental proxy, not evidence of task preservation.

## Remaining boundaries and next action

**No remaining blocker for local core use or browser embeddings in the tested Chromium environment.** Open **http://127.0.0.1:5173/**. Enable embeddings when desired; new browser profiles need public model/runtime downloads. Other browsers, disconnected first use, and deployment under a hosted repository subpath were not tested.

Live Gemini, provider access and billing remain deliberately **unverified and unauthorized**. The optional Python LLMLingua adapter, composite score, complete entity recognition, replay import and raw vocabulary-byte inspection remain deferred. No task-performance or state-of-the-art claim follows from these tests. Publishing and deployment still require the user's authorization.
