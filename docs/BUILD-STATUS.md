# Build status: locally verified development build

## Phase 1 update — September 8, 2026

**First-time UX and result clarity: COMPLETE; commit-ready.** Changes are left uncommitted for human review. Full change list, decisions, failure history and limitations: [IMPLEMENTATION-LOG](IMPLEMENTATION-LOG.md).

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

The folder initially had no Git repository. A local repository now retains the verified source, generated lockfile, tests and evidence. No remote was configured; secrets, dependencies, model caches and build output are excluded.

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
