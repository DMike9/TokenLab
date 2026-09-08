# TokenLab implementation log

## Phase 1 — First-time UX and result clarity

Status: COMPLETE
Date: 2026-09-08
Commit-ready: YES

### Changed

- Added session-only Explore / Research views. Explore runs three real presets: redundancy removal, protected negation during destructive function-word ablation, and an infeasible 10% retained budget. Research retains every existing method, control, model option, notebook, protection inspector and Gemini Arena. No algorithm expansion.
- Added recorded result settings for method/chain, tokenizer, budget, transform, applicable cutoff/floor and measured model/revision. All stored settings remain inspectable. Editing controls displays “Settings changed — run again to update the result.” Tokenizer edits no longer hide the recorded result or relabel its measurements. Token inspection uses that result's encoding and can explicitly reload older tokens.
- Reproduced the protection-analysis defect before implementation: analyze `ordinary background. rare phrase.`, add custom protection `rare phrase`, and the protected count incorrectly remained **0**. The new browser regression failed on that exact observation. Analysis snapshots now include protected terms; edits invalidate stale analysis, and the next analysis or run refreshes it. The unchanged regression now passes.
- Separated token savings, embedding cosine, detected protected-occurrence retention and task correctness with explanatory copy. Compression-run task status is explicitly “Not evaluated”; separate downstream evaluations remain in the optional Arena. Added explanatory zero-savings, protected JSON, infeasible-budget and unavailable-model states. Chain budget status is explicitly scoped to its final stage.
- Added an explicit export-scope selector for current prompt plus tokenizer, or full session, honored by JSON and CSV. JSON records the selected scope. Prompt text remains excluded by default.
- Added associated tabs/panels, roving tabindex, automatic activation with Left/Right/Home/End, keyboard traversal into the active panel, and visible focus. Hidden Research content is excluded from navigation.
- Rewrote the README opening for portfolio readers with the project question, immediate experiments/start command, implemented versus research scope, a real screenshot and substantial AI-assistance disclosure. Updated architecture documentation.

### Files changed

- `src/App.tsx`
- `src/components/ResultContext.tsx` (new)
- `src/components/ResultTabs.tsx` (new)
- `src/hooks/useLab.ts`
- `src/workers/lab.worker.ts`
- `src/styles.css`
- `e2e/phase1.spec.ts` (new)
- `e2e/lab.spec.ts`
- `e2e/coverage.spec.ts`
- `e2e-model/embedding.spec.ts`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/BUILD-STATUS.md`
- `docs/IMPLEMENTATION-LOG.md` (new)
- `docs/verification/phase1/{explore-desktop.png,explore-mobile.png,result-desktop.png,result-mobile.png,embedding-results.png,embedding-evidence.json}` (new real evidence)

### Verification

| Executed command | Actual result |
| --- | --- |
| `npm run test:e2e -- e2e/phase1.spec.ts` before the fix | **1 failed**, confirming protected count stayed 0 after a matching custom term was added. |
| Same focused regression after the fix | **1 passed**. |
| Expanded Phase 1 suite, first run | **6 passed / 1 failed**: the focused tab had no visible outline after programmatic focus from a pointer interaction. Added a visible tab focus outline; assertions were retained. |
| `npm run test:e2e -- e2e/phase1.spec.ts`, final | **7 passed / 0 failed** (37.0 s). |
| `npm run verify`, final | **Passed**: strict TypeScript, **140/140 Vitest tests**, **14/14 mocked gateway tests**, and production build (46 modules; 8.94 s). Gateway tests did not contact Google. |
| `npm run check:core` | **71/71 passed**. Pure-engine character counters remain explicit test seams. |
| `npm run test:e2e` | **13/13 passed** (37.7 s), including all prior example, math, chain, Unicode, protection, diff and export checks. Existing assertions were preserved; tests now explicitly choose Research and full-session export where required by their purpose. |
| `npm run test:model` | **2/2 passed** (27.6 s), real public model downloads and browser-worker inference. Model snapshot/floor/revision display and disabling embeddings without rewriting measured results were checked, as was the existing long Unicode tail test. |
| `npm audit` | **0 vulnerabilities**. Dependencies/lockfile unchanged in this phase. |
| `git diff --check` | Passed. |
| `npm run dev` | An existing Vite server already owned port 5173, so another start correctly failed with “Port 5173 is already in use.” Reused the existing project server; HTTP GET returned **200** at **http://127.0.0.1:5173/**. |

No live Gemini process or paid calls were run. No keys were read, printed or committed. No push or deployment occurred. Phase 1 changes are left uncommitted for human review and commit/push.

### Browser checks

Inspected actual Playwright Chromium screenshots at **1440×1000 desktop** and **390×844 mobile**. Checked Explore presets, switching views, immutable results after control/tokenizer changes, protection analysis invalidation, keyboard tabs, zero/infeasible states, both export scopes/formats, and Research's existing flows. Mobile tests measured no page-wide overflow. Instrumented guides and example sweeps recorded no page or console errors.

- [Explore desktop](verification/phase1/explore-desktop.png)
- [Explore mobile](verification/phase1/explore-mobile.png)
- [Desktop result](verification/phase1/result-desktop.png)
- [Mobile result](verification/phase1/result-mobile.png)
- [Real embedding results](verification/phase1/embedding-results.png) / [measurements](verification/phase1/embedding-evidence.json)

The in-app browser connection still returned `missing field sandboxPolicy`; the installed Playwright Chromium fallback supplied all browser evidence. The model test recorded **Xenova/all-MiniLM-L6-v2**, revision **751bff37182d3f1213fa05d7196b954e230abad9**, q8/WASM, with no recorded model-test console or failed-request errors.

### Known limitations

No unresolved Phase 1 functional blocker. Browser verification covers Chromium desktop/mobile viewports, not physical mobile devices, other browsers or a manual screen-reader audit. Phase 1's production build passed; its changed UI was exercised on the development server, not separately on preview or a deployed subpath. The earlier production-model evidence remains historical.

Mode choice and history remain in memory. Similarity remains a proxy; protection is incomplete heuristic detection; no downstream task-quality claim was added. Compression-run task status does not aggregate or persist separate Arena evaluations.

### Decisions requiring review

No approval blocks remain. The reviewer can assess these deliberately small assumptions:

- Explore is the default on each reload. It hides advanced controls without removing or resetting them when switching views.
- Clicking a guide replaces the editor and controls with documented presets, including disabling embeddings for that guided run, but retains prior session experiments. It does not create a second demo engine.
- Settings-change detection conservatively considers every draft control, including unused parameters. Recorded metadata explicitly marks inapplicable settings.
- “Current prompt” export includes the selected tokenizer, matching the visible notebook. Full-session export is an explicit choice; text remains opt-in in either scope.
- Existing transform buttons remain immediate run actions. Sliders represent draft settings. A completed sweep leaves the controls on the last recorded transform so its result does not immediately appear stale.

### Deferred

Phase 2 and later work remain untouched: explicit task anchors, LLMLingua, trained models, benchmark datasets, paid Gemini evaluation, deployment, a composite TokenLab score and cloud infrastructure. Stop after Phase 1.
