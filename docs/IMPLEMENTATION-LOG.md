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

No live Gemini process or paid calls were run. No keys were read, printed or committed. No push or deployment occurred.

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

## 2026-09-08: Dependabot cleanup

### Scope and decision

Inspected the local Dependabot file, package.json, real package-lock.json, both Actions workflows, and all ten open Dependabot PRs through the connected GitHub tools. Read each PR's metadata, release notes and diff, and fetched the workflow run associated with each PR head. No dependency or action upgrade is required now on the evidence available. Recommend merging **none** and closing/deferring **#1–#10**. These are individual major-version update PRs; replace routine future churn with the grouped policy below, rather than combining these majors into a single upgrade.

The inspected PRs were based on initial commit `2439101527ac49670bd8323414814ef084d6a0f1`; local Phase 1 is committed as `50735a5`. Green historical PR checks are useful evidence, not verification of those upgrades against today's application. No candidate branch was applied locally or represented as locally validated.

### Configuration

- Both npm and GitHub Actions remain on a weekly schedule at the repository root.
- Each ecosystem permits one open routine PR and has one group covering minor/patch updates. This bounds routine open PRs at two across the repository; compatible React/runtime/tooling updates can travel together and still require review and CI.
- `allow.update-types` permits only `version-update:semver-minor` and `version-update:semver-patch`. GitHub explicitly documents that this filter does **not** apply to security updates, including fixes requiring a major.
- Groups explicitly apply only to `version-updates`; security updates are not folded into routine groups or constrained by their open-PR limit. No broad ignored version ranges, security-alert dismissals, auto-merge, alternate target branch or workflow-permission changes were introduced.

Policy behavior was checked against [GitHub's current Dependabot reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#update-types-allow) and the YAML was validated against the current [SchemaStore Dependabot schema](https://json.schemastore.org/dependabot-2.0.json). The policy is defined in `.github/dependabot.yml`; GitHub applies the configuration on the default branch.

### PR disposition and compatibility evidence

| PR | Exact dependency/action update | Disposition | Observed PR CI | Reason and evidence still required |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/DMike9/TokenLab/pull/1) | actions/upload-artifact from 4 to 7 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253863486) | CI passed, but this skips three action majors and changes artifact/runtime behavior. Defer to a coordinated Actions maintenance change with upload/download evidence review; no immediate TokenLab security fix was established. |
| [#2](https://github.com/DMike9/TokenLab/pull/2) | actions/upload-pages-artifact from 3 to 5 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253869229) | CI passed but does not execute this manual Pages action. Defer the two-major artifact change until the Pages artifact/deployment contract can be checked together with the other Pages actions. |
| [#3](https://github.com/DMike9/TokenLab/pull/3) | actions/configure-pages from 5 to 6 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253872339) | CI passed but does not execute the manual Pages configuration step. Defer to the coordinated Pages migration; permissions and configuration behavior still need validation. |
| [#4](https://github.com/DMike9/TokenLab/pull/4) | actions/deploy-pages from 4 to 5 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253880516) | CI passed but never runs the manual deployment job. Defer its runtime/deployment migration until deployment is authorized and the Pages action set can be verified together. |
| [#5](https://github.com/DMike9/TokenLab/pull/5) | actions/setup-node from 4 to 7 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253889894) | CI passed for Node 22 setup, but the PR also changes the unexecuted Pages workflow and skips three majors. Defer a coordinated runner/cache/runtime review. Upstream notes include dependency security fixes; their applicability to this repository has not been established (see risks below). |
| [#6](https://github.com/DMike9/TokenLab/pull/6) | vitest from 4.1.11 to 5.0.0 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253908309) | CI passed on the earlier application baseline. Defer a dedicated test-runner migration: the diff changes the Vitest dependency graph and runtime/peer requirements. Revalidate the current application and browser suites together with the Vite compatibility matrix. |
| [#7](https://github.com/DMike9/TokenLab/pull/7) | vite from 7.3.6 to 8.2.2 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253935219) | CI passed on the earlier application baseline. Defer a dedicated build-tool migration; require current production worker, tokenizer/WASM asset and real browser embedding checks, which ordinary CI does not cover. |
| [#8](https://github.com/DMike9/TokenLab/pull/8) | @huggingface/transformers from 3.8.1 to 4.2.0 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253942708) | CI passed, but regular CI does not run test:model. Defer until actual browser-worker inference, model/revision resolution, q8/WASM loading and full long-input chunking pass on Transformers 4; the existing real-model evidence is for 3.8.1. |
| [#9](https://github.com/DMike9/TokenLab/pull/9) | @types/node from 22.20.1 to 26.4.1 | Close / defer | [success](https://github.com/DMike9/TokenLab/actions/runs/34253951895) | CI passed, but Node 26 declarations exceed the Node 22 CI/minimum-runtime contract and can admit unavailable APIs. Keep the types on major 22 until an intentional runtime-support change. |
| [#10](https://github.com/DMike9/TokenLab/pull/10) | typescript from 5.9.3 to 7.0.2 | Close / defer | [failure](https://github.com/DMike9/TokenLab/actions/runs/34253964895) | CI failed at npm run check:core; browser installation/tests were skipped. TypeScript 7 changes compiler packaging, while scripts/check-core.mjs explicitly launches node_modules/typescript/bin/tsc with Node. Investigate that compatibility boundary in a dedicated migration; this inspection did not reproduce the exact error locally. |

For #10, the GitHub job step API showed `npm run verify` succeeded, `npm run check:core` failed, and both Playwright steps were skipped ([job](https://github.com/DMike9/TokenLab/actions/runs/34253964895/job/102154949010)). No assertions or compiler safeguards were changed to accept this upgrade.

**Remote disposition:** Closed **#1, #2, #3, #4, #5, #6, #7, #8, #9 and #10** through the connected GitHub update-pull-request tool on 2026-09-08, 18:34:58–18:35:49 UTC. Every response confirmed `state: closed` and `merged: false`. A fresh repository search for `is:pr is:open` then returned **zero PRs**. No PR was merged and no bot ignore commands were posted. No PR is recommended for merge.

### Commands and results for this cleanup

| Executed command/check | Actual result |
| --- | --- |
| `npm audit --json` | Passed; **0 vulnerabilities** in the current npm dependency graph. This does not audit bundled GitHub Action dependencies. |
| `npm run verify` | Passed: strict TypeScript, **140/140 Vitest tests**, **14/14 mocked gateway tests**, and Vite 7.3.6 production build (46 modules). |
| `npm run check:core` | **71/71 passed** with the retained TypeScript 5.9.3 toolchain. |
| `gh --version` | GitHub CLI unavailable; the connected GitHub tools provided PR reads and disposition access instead. |
| `.cache/tiktoken-venv/Scripts/python.exe -c "import yaml,jsonschema; print('YAML and JSON Schema available')"` | Initially failed: PyYAML was absent from the existing ignored local Python environment. |
| `.cache/tiktoken-venv/Scripts/python.exe -m pip install PyYAML jsonschema` | Passed; installed only local validation tools in the ignored environment, without editing application dependencies or the npm lockfile. |
| `Invoke-WebRequest -Uri https://json.schemastore.org/dependabot-2.0.json -OutFile .cache/dependabot-schema.json` | Downloaded the actual schema; it supports `allow.update-types`. |
| YAML/JSON Schema validation command below | Passed with no schema errors. |
| `git diff --check` | Passed; Git reported only its existing Windows LF-to-CRLF normalization notice. |

Exact YAML validation command:

```powershell
.cache/tiktoken-venv/Scripts/python.exe -c "import json,yaml,jsonschema; from pathlib import Path; schema=json.loads(Path('.cache/dependabot-schema.json').read_text(encoding='utf-8')); config=yaml.safe_load(Path('.github/dependabot.yml').read_text(encoding='utf-8')); jsonschema.validate(config,schema); print('PASS: Dependabot YAML validates against SchemaStore schema')"
```

No browser/model suites were rerun for this configuration/documentation-only change. Earlier Phase 1 browser/model results above remain historical evidence for the retained versions. Package manifests, lockfile, application source, action references and tests are unchanged. Gateway tests mocked Google; no real Gemini calls, secret reads, push or deployment occurred.

Final scope check: `git diff --exit-code -- package.json package-lock.json .github/workflows src tests e2e e2e-model` returned 0 with no differences. That cleanup changed only `.github/dependabot.yml`, `docs/IMPLEMENTATION-LOG.md` and `docs/BUILD-STATUS.md`. It did not create a commit.

### Unresolved risks and revisit criteria

- That maintenance pass did not observe a GitHub scheduler run. Schema validation and documentation review are local evidence, not an observed Dependabot scheduling run.
- Repository-level Dependabot alerts/security-update settings were not exposed by the available connector and could not be confirmed; YAML preserves eligibility but cannot enable those settings itself. Keep both enabled in repository settings. No security alert was dismissed.
- The clean npm audit is a point-in-time result and does not prove the Actions bundles are vulnerability-free. [setup-node release notes](https://github.com/actions/setup-node/releases/tag/v6.5.0) mention security overrides for undici/fast-xml-parser; the [upstream advisory page](https://github.com/actions/setup-node/security/advisories) did not establish a TokenLab-specific remediation requirement. The workflows currently do not request package-manager caching. Prioritize an Actions review if an applicable advisory or runner-runtime retirement affects the retained majors.
- Review deferred majors at the next maintenance milestone, or earlier for an applicable security fix, upstream support retirement or a required capability. Security-driven majors must receive an explicit compatibility review; they remain eligible for Dependabot PRs.
- Floating major Actions tags can receive upstream minor/patch changes without a new PR. This cleanup retains that existing choice; it does not establish immutable action pinning.
- For a future npm major migration, run `npm ci`, `npm run verify`, `npm run check:core`, `npm run test:e2e`, and `npm run test:model` where worker/model/build behavior is affected. For Actions, verify both CI artifact behavior and the coordinated Pages workflow within the authorization then available.

## Phase 2 — Task focus and interpretable importance

Status: COMPLETE
Date: 2026-09-08
Commit-ready: YES

### Current-behavior audit

Before production changes, added `tests/scoring-audit.test.ts` and ran `npm test -- tests/scoring-audit.test.ts`: **7/7 passed** against Phase 1. Initial assertions used incorrect indexes/counts because punctuation followed by newlines can produce whitespace-only chunks and protected spans can bridge candidate boundaries. Corrected the test fixtures to address text-bearing chunks and actual detected spans; production code was unchanged at the time.

Trace: `protectedSpans` detects reason-tagged occurrences; `splitChunks` refuses cuts inside them and marks any overlapping chunk with their reasons. `scoreChunks` selected the final nonempty chunk, used lexical cosine (embedding cosine only for enabled hybrid), empirical word-frequency information and earlier-chunk bigram redundancy. Instruction/entity/structure indicators came solely from hard-protection reasons. Hybrid used user weights; importance/similarity used defaults. Five positive products were divided by their weight sum, then the redundancy penalty was subtracted and the result clipped. Transforms applied to all chunks. Protected chunks entered the retained set before filtering, irrespective of score/cutoff/budget. Eligible chunks competed by transformed score divided by isolated token cost; every admission retokenized the full assembled string.

Evidence: a relevance-only score is 0 for `alpha.` and 1 for final `beta.`. Each protection-related weight leaves hard-protected output unchanged even with zero scores, cutoff 1 and budget 0 (correctly unmet). Raising any of those weights from 0 to 10 changes eligible rankings through the denominator: in `alpha. / alpha beta. / alpha beta.`, the repeated final chunk falls from 0.8 to 0 while the first falls from about 0.707 to 0.064. The unchanged 0.2 redundancy penalty causes the order reversal. Without the penalty, common positive rescaling cannot reorder a fixed ranking but can change cutoff admission. These controls did not independently establish feature usefulness on eligible text. The seven characterization cases remain, now explicitly selecting the legacy anchor.

### Changed

- Added deterministic Auto, user-selected original-chunk and Legacy final-chunk policies with ranked reasons, explicit invalid-selection/no-signal/empty fallbacks, stable slice identifiers and SHA-256 focus hashes. Resolution stays fixed to the original through a chain; no hidden second prompt or expected-answer input was introduced.
- Preserved the hard detector and original-occurrence guards. Chunks/decisions now distinguish hard protection from independently observed text features. Score records contain effective weights, normalized per-feature contributions, raw/clipped/shaped scores, relevance method and model provenance when used. Whitespace-only chunks explicitly report unavailable relevance instead of claiming embedding inference.
- Research adds the focus preview/selector, candidate explanation, recorded-focus disclosure, notebook policy column and keyboard-accessible score drill-down. Explore retains its guides and hides advanced controls. Existing immutable-result and protection-invalidation behavior remains covered.
- Added the task-before-background example. JSON schema 2 and CSV record focus and per-stage score metadata; redaction removes raw focus and every stage's decision text. Engine version is `tokenlab-0.2.0`; package dependencies/version remain unchanged.
- Updated architecture, README research framing and the roadmap's already-implemented status. No Phase 3 work.

### Files changed

- `src/engine/{taskFocus.ts,types.ts,chunks.ts,scoring.ts,strategies.ts,runner.ts,export.ts}`
- `src/components/{TaskFocusControls.tsx,ScoreDetails.tsx,ResultContext.tsx}`
- `src/{App.tsx,styles.css,examples.ts}`
- `tests/{scoring-audit.test.ts,task-focus.test.ts}`
- `e2e/phase2.spec.ts`, `e2e-model/embedding.spec.ts`
- `README.md`, `docs/{ARCHITECTURE.md,ROADMAP.md,BUILD-STATUS.md,IMPLEMENTATION-LOG.md}`
- `docs/verification/phase2/`: curated desktop/mobile PNGs and compact redacted focus/model/tail measurements.

### Verification

| Command actually executed | Result |
| --- | --- |
| `npm test -- tests/scoring-audit.test.ts`, before production changes | **7/7 passed** after correcting fixture assumptions about whitespace/boundaries. The initial draft had **7 failures**; no production behavior was changed to make those expectations pass. |
| `npm test -- tests/scoring-audit.test.ts tests/task-focus.test.ts`, initial Phase 2 | **23/23 passed**. A later empty-relevance regression adds one test. |
| `npm run typecheck`, during development | Caught an implicit-any array in the new test; added the concrete `Run[]` type. Final strict check passes. |
| `npm run verify`, final | **Passed**: strict TypeScript, **164/164 Vitest tests** (the existing 140 plus 24 focused tests), **14/14 mocked gateway tests**, and Vite production build (49 modules). |
| `npm run check:core` | **71/71 passed**; dependency-injected counters remain explicit test seams. |
| `npm run test:e2e -- e2e/phase2.spec.ts`, initial/fixed | Initial **3 failed** because wrapped-select label matching included option text; explicit accessible names fixed the selectors. The next focused run was **3/3 passed**. A fourth browser case subsequently exercises real sliders/BPE/notebook selection. |
| `npm run test:e2e`, final | **17/17 passed** (55.0 s), including the added visible-slider/BPE and notebook-restoration case. The all-example regression now executes 9 examples × 7 non-model-required methods = **63 experiments**. |
| `npm run test:model` | **3/3 passed** (50.3 s in the final model run), including actual task-focus embedding relevance and the existing full long-input checks. |
| `npm audit` | **0 vulnerabilities**; dependencies and lockfile unchanged. |
| `node .cache/capture-phase2.mjs` | Real Chromium captures at 1440×1000 and 390×844; no page-wide overflow. The ignored helper only drives the local app. |
| `git diff --exit-code -- package.json package-lock.json src/engine/protection.ts .github` | Returned 0: no dependency, hard-detector, Dependabot or workflow changes. |
| `git diff --check` | Passed (only the existing Windows line-ending normalization notices). |
| `(Invoke-WebRequest -Uri http://127.0.0.1:5173/ -UseBasicParsing).StatusCode` | **200**, reusing the existing Vite development server. |

No live Gemini calls, secrets inspection, push or deployment. No test was deleted or relaxed to accept a production regression. The browser and model suites were rerun after the explicit missing-relevance change; the final extra slider test covers the actual UI range and BPE budget rather than relying only on word-count seams.

### Browser checks

Inspected actual Chromium screenshots at **1440×1000 desktop** and **390×844 mobile**: task preview, candidate reasons, score tables, immutable recorded settings, notebook policy comparison and model provenance. No page-wide overflow or recorded page/console errors in the instrumented Phase 2 flows. Internal result-list scrolling remains intentional. Checked keyboard Enter on contribution details and arrow movement between result tabs. Full Phase 1 browser cases still cover guides, stale settings, custom-protection invalidation, export scopes, Unicode token inspection, impossible budgets and keyboard tabs.

- [Desktop Research](verification/phase2/research-1440.png) / [mobile contributions](verification/phase2/scores-390.png)
- [Policy-comparison notebook](verification/phase2/notebook-1440.png)
- [Compact model measurements](verification/phase2/focus-embedding-evidence.json)
- [Lexical focus measurements](verification/phase2/focus-evidence.json) / [long-input measurements](verification/phase2/tail-evidence.json)

The in-app browser bootstrap again failed with `missing field sandboxPolicy`; installed Playwright Chromium supplied the browser evidence. No physical-device, other-browser, manual screen-reader or deployed-site verification is claimed.

Real model: **Xenova/all-MiniLM-L6-v2**, **q8/WASM**, revision **751bff37182d3f1213fa05d7196b954e230abad9**. The teaching prompt produced the following measurements with default hybrid weights, a 65% budget and 0.25 cutoff:

| Focus policy | Original chunk (1-based) | Compressed tokens / original 49 | First instruction's embedding relevance | Whole-output cosine |
| --- | --- | --- | --- | --- |
| Auto | 1 | 30 | 1.0000 | 0.9693 |
| Legacy | 11 | 21 | 0.1556 | 0.8390 |
| User selected | 1 | 30 | 1.0000 | 0.9693 |

All three retained the detected protected occurrence. These are different proxy/savings outcomes, not evidence of better answers. In the lexical browser comparison Auto/Legacy both produced 28 tokens; selecting original context chunk 3 produced 24. Long Unicode tails still produced 7 and 5 embedding windows, 384-dimensional vectors, and cosine **0.5246208440170577**, with no recorded model-test console or failed-request errors.

### Weight-sensitivity evidence

| Feature/control | Observed evidence | Limit |
| --- | --- | --- |
| Relevance versus information | With a binding word-count budget, relevance selects `common common.`; empirical information selects `rare unique.` from the same eligible competitors. | Synthetic selection test, not a learned estimate of useful information. |
| Redundancy penalty | At weight 0 both eligible `alpha beta.` occurrences survive; at weight 1 the repeated occurrence is excluded while `gamma delta.` survives. | Earlier-chunk bigram overlap is position-sensitive. |
| Instruction signal | Eligible `could you help?` competes with ordinary background; its weight changes selection. | Many explicit imperatives already have hard protection and cannot be removed by changing this weight. |
| Entity signal | Eligible `orchards near Kyoto thrive.` gains preference under the independent entity weight. | Single internal capitalization is a weak signal, not named-entity recognition. |
| Structure signal | Eligible `context: orchard irrigation.` gains preference under the structure weight. | Labels are a surface cue; most strong Markdown/JSON/code structures are already protected. |
| Contribution formula | Fixture gives relevance 0.288, information 0.102, instruction 0.200 and redundancy −0.076, totaling raw 0.514; zero weights and invalid weights are checked. | The positive denominator couples slider effects; no probability interpretation. |

The new instruction/entity/structure sensitivity fixtures use **relevance 0.1 and feature weight 0→1**, within the visible slider range. The pre-change denominator audit deliberately used larger engine weights to isolate normalization; it is not represented as a UI preset. A real-browser instruction-slider case additionally checks actual BPE output and notebook restoration. No protection was weakened to obtain sensitivity. Protected chunks survive at score zero/cutoff one/impossible budget across the characterized cases, and all focus policies preserve original protected occurrences.

### Known limitations

Auto is English pattern matching and chooses a single chunk. It can miss implicit/distributed tasks and conservatively skips chunks containing opaque quoted/code/JSON spans, including mixed prose. Fallbacks and tied-candidate rules are explicit. User selection is an assumption, not ground truth. Chunk numbers include whitespace slices; changed text/protection boundaries can invalidate a selection.

Legacy reproduces the final-original-chunk anchor rule, **not the entire Phase 1 scorer**: independent soft signals change feature values, and a chain now holds the original focus fixed. The model and information/redundancy features remain proxies. Selection stays greedy, cutoff-sensitive and token-cost-sensitive; hard constraints can make the budget infeasible. No downstream answer evaluation was performed.

Schema 2 is a changed export contract; no importer or backwards replay is implemented. Redacted metadata remains potentially identifying, and hashes are not anonymization. The UI's result score list shows the final stage; exports retain all stages. Browser inference relies on available public model/runtime assets; the tested model snapshot does not establish cross-browser or multilingual task correctness.

### Decisions requiring review

No approval blocker remains. Review these explicit choices: earliest-original tie-breaking, whole-chunk opaque exclusion for Auto, invalid user selection falling back visibly to the legacy rule, fixed original focus across chains, independent binary surface signals, and retaining the weighted denominator/defaults while explaining their coupling. Explore guides reset to Auto through their existing default-setting behavior; ordinary mode switching preserves the draft selection.

### Deferred

Stop after Phase 2. No benchmark corpus, paid Gemini trials, LLMLingua, trained compressor, LLM judge, composite quality score, cloud backend, public deployment, automatic task-performance claims or Phase 3 implementation.

### Pre-push hygiene audit — 2026-09-08

Git initially reported **0 staged files**, with **36 pending Phase 2 files** in the working tree. Audited that intended change set, then staged the curated **28-file** snapshot. No files were removed from an existing index because it was empty. Source, tests, application configuration and dependencies were not changed by this audit.

Each original pending file is classified below. No pending item was a secret/local-only file or an accidental generated/cache artifact; the eight excluded images were redundant copies of already-covered views. The public set retains three distinct screenshots: desktop task focus/result, mobile contribution inspection, and notebook policy comparison. The notebook image comes from the final successful browser-suite capture.

| File | Classification | Disposition |
| --- | --- | --- |
| `README.md` | REQUIRED DOCUMENTATION | Retained |
| `docs/ARCHITECTURE.md` | REQUIRED DOCUMENTATION | Retained |
| `docs/BUILD-STATUS.md` | REQUIRED DOCUMENTATION | Retained |
| `docs/IMPLEMENTATION-LOG.md` | REQUIRED DOCUMENTATION | Retained |
| `docs/ROADMAP.md` | REQUIRED DOCUMENTATION | Retained |
| `docs/verification/phase2/contributions-1440.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/contributions-390.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/focus-embedding-evidence.json` | USEFUL VERIFICATION EVIDENCE | Retained compact measurement projection |
| `docs/verification/phase2/focus-embedding.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/focus-evidence.json` | USEFUL VERIFICATION EVIDENCE | Retained compact measurement projection |
| `docs/verification/phase2/notebook-1440.png` | USEFUL VERIFICATION EVIDENCE | Retained |
| `docs/verification/phase2/notebook-390.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/research-1440.png` | USEFUL VERIFICATION EVIDENCE | Retained |
| `docs/verification/phase2/research-390.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/scores-1440.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/scores-390.png` | USEFUL VERIFICATION EVIDENCE | Retained |
| `docs/verification/phase2/tail-evidence.json` | USEFUL VERIFICATION EVIDENCE | Retained |
| `docs/verification/phase2/task-focus-1440.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `docs/verification/phase2/task-focus-390.png` | DUPLICATIVE OR UNNECESSARY | Deleted redundant screenshot |
| `e2e-model/embedding.spec.ts` | REQUIRED TEST | Retained |
| `e2e/phase2.spec.ts` | REQUIRED TEST | Retained |
| `src/App.tsx` | REQUIRED SOURCE | Retained |
| `src/components/ResultContext.tsx` | REQUIRED SOURCE | Retained |
| `src/components/ScoreDetails.tsx` | REQUIRED SOURCE | Retained |
| `src/components/TaskFocusControls.tsx` | REQUIRED SOURCE | Retained |
| `src/engine/chunks.ts` | REQUIRED SOURCE | Retained |
| `src/engine/export.ts` | REQUIRED SOURCE | Retained |
| `src/engine/runner.ts` | REQUIRED SOURCE | Retained |
| `src/engine/scoring.ts` | REQUIRED SOURCE | Retained |
| `src/engine/strategies.ts` | REQUIRED SOURCE | Retained |
| `src/engine/taskFocus.ts` | REQUIRED SOURCE | Retained |
| `src/engine/types.ts` | REQUIRED SOURCE | Retained |
| `src/examples.ts` | REQUIRED SOURCE | Retained |
| `src/styles.css` | REQUIRED SOURCE | Retained |
| `tests/scoring-audit.test.ts` | REQUIRED TEST | Retained |
| `tests/task-focus.test.ts` | REQUIRED TEST | Retained |

The two browser session dumps shrank from **101,773 → 20,418 bytes** and **124,393 → 21,646 bytes**. Compact evidence preserves input/output/focus hashes, method/settings/model revision, protection and budget results, cosine/distance measurements, and every nonempty chunk's features/contributions/selection. Duplicate stage records, session IDs, timing samples and whitespace-only scoring rows were omitted. These files explicitly identify their source tests and their curated format; they are not complete schema-2 exports. The separate **124-byte** long-tail result remains unchanged. Full local captures stay in ignored storage and can be regenerated by the existing browser tests.

Normalized obsolete handoff/status language and repaired links after screenshot curation. No personal absolute paths were found in the intended text files. Platform/runtime versions and relative commands remain useful reproduction context; scientific caveats and actual failure history remain intact.

Validation during this audit: `.cache/validate-hygiene.py` verified all **17 source/test file hashes unchanged**, measurement projections against original captures, input hashes against the built-in example, contribution sums and protection invariants, relative links in all five changed documents, and **13 ignored-path probes**. `.gitignore` already covers node_modules, dist, secret environment files (retaining the template exception), browser/model/Python caches under `.cache`, core/test build output, coverage, Playwright reports/results, logs and macOS metadata; no ignore changes were necessary.

Credential-pattern and personal-path scans returned no findings. PNG inspection found no text/EXIF metadata; the three retained screenshots were visually inspected and contain only the running synthetic-example UI. Ignored environment files and credentials were not opened. Final staged-content/path scan of all 28 files and the full cached diff found no credential/personal-path matches or local-only artifacts; `git diff --cached --check` passed. No application suites were rerun because source, tests and configuration are unchanged from the verified Phase 2 build. No commit, push, deployment or live Gemini calls occurred in this audit.

## Hardening Gate ? Post Phase 2

Status: PASS
Date: 2026-09-09
Commit-ready: YES

### Audit findings

Twelve repaired findings: 0 Critical, 2 High, 5 Medium, 5 Low. [HARDENING-REPORT](HARDENING-REPORT.md) records severity, observed behavior, risk, reproduction, fix, regression and residual limitation for each. No unresolved Critical/High defect is known from the reviewed paths. The report was started with actual source architecture/trust boundaries before implementation changes.

### Repairs

Fixed adjacent instruction detection, overlapping/duplicate literal protection and identifier ablation; entry-time run snapshots, UI operation generations and worker callback identity checks; nonfinite settings/math/vector validation; capped-token labeling; export numerical/formula defenses and opt-in reset; rejected-stage budget labeling; dense chunking and full-value paste; zoom overflow; gateway schema/error handling. Updated only the existing sharp override to 0.35.4 and pinned six Actions to verified same-major releases. Engine evidence version is 0.2.1; application package version remains 0.1.0.

### Files changed

- Engine: chunks, protection, runner, scoring, math, transforms, export, and new settings validation.
- Runtime/UI: App, useLab, ResultContext, TokenInspector, tokenizer adapter, embedding validation, extracted embedding-window function, and one metric-grid CSS rule.
- Gateway source/mocked tests; package manifest/real lockfile; CI/Pages Action pins; Python/cache ignores.
- Tests: hardening corpus/contracts/limits/model-failure tests; targeted independent fixture/generator; hardening browser tests; stronger real-model tests and tokenizer fixtures.
- README, START-HERE, SECURITY, ARCHITECTURE, ROADMAP, BUILD-STATUS, this log, new HARDENING-REPORT and curated verification/hardening evidence.

### Tests added/strengthened

21 synthetic adversarial cases ? 7 strategies ? 3 actual encodings = 441 implementation attacks inside three aggregate tests. These are NOT the Phase 3 benchmark dataset. The overall Vitest suite grew from 164 to 202, gateway from 14 to 20 and ordinary browser suite from 17 to 26. Existing assertions remain. Added 12 independent tiktoken fixtures, bringing the fixture total to 48. Vector/counter/transport seams are explicitly labeled and separate from actual BPE/model inference.

### Verification

Final `npm ci`, `npm run verify` (202 Vitest, 20 gateway, TypeScript, production build), `npm run check:core` (71), `npm run test:e2e` (26), `npm run test:model` (3), `npm audit` (zero) and `git diff --check` passed. Production preview model/UI/export smoke passed 1/1 on the final bundle. Exact commands/timings are in BUILD-STATUS. No paid calls.

Initial hardening tests failed 7/12 before fixes. New numerical validation exposed floating-point feature overshoot; clipping at analytical bounds fixed the cause. Browser tests exposed content-zoom overflow and Chromium native multiline insertion; the repaired test uses the actual clipboard path with the same maximum-input assertion. Windows clipboard CRLF is normalized as by native textareas. A clean install failed EPERM while dev held esbuild; after stopping only the workspace process, it passed. A redundant parallel model rerun lost its test-owned dev server and was interrupted; final tests used a stable separately managed server. Failure history is retained instead of calling these attempts successful.

### Browser checks

Inspected actual 1440?1000, 1024?768, 390?844 and 200% content-zoom captures. Tested keyboard tabs/details/token pages/measured chart points, stale controls, quick clicks, cancellation/clear/restart/late messages, download failure, XSS text, export scopes, huge paste, all examples and real model-enabled methods. The in-app browser connection failed; Playwright Chromium was the documented fallback. Native browser UI zoom, physical devices and manual screen readers remain unverified.

### Security/privacy checks

No credential-pattern findings or tracked/historical secret environment paths in the scoped public-file audit. No secret contents opened. No prompt persistence, unsafe HTML rendering or core remote inference path found. Explicit consent remains required for optional Gemini, which was mocked only. sharp patch/native smoke and zero audit passed. Action tag/SHA identity, YAML and permissions were checked; remote CI/deployment was not run. Curated evidence contains synthetic prompts/measurements only.

### Mutation evidence

Seven temporary faults (negation, budget, task-focus tie, token count, redaction, stale settings and final guard) each caused a focused test failure. Source bytes were restored in finally blocks and hashes verified after each mutation. No broken source or heavy mutation framework retained.

### Remaining limitations

Conservative/incomplete English protection and focus; greedy scoring; embedding proxy/long-input pooling; metadata is not anonymous; multiline terms supported only by engine API; no raw vocabulary bytes/replay. Other browsers, native zoom, manual screen readers, offline first use, public hosting and live Gemini remain unverified. Limits and residual caveats are explicit in the report; no unsupported task-preservation or optimum claim.

### Deferred

Phase 3 datasets/evaluation, live Gemini, LLMLingua, new compression algorithms, composite scores, import/replay, cloud infrastructure and deployment. No commit, push or deployment occurred in this gate.

### Gate recommendation

**PASS. SAFE TO COMMIT/PUSH after human review.** This recommends the local change set for the experimental project; it does not perform a push or authorize deployment. Stop after this hardening gate.
