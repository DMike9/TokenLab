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

## 2026-09-08: Dependabot cleanup

### Scope and decision

Inspected the local Dependabot file, package.json, real package-lock.json, both Actions workflows, and all ten open Dependabot PRs through the connected GitHub tools. Read each PR's metadata, release notes and diff, and fetched the workflow run associated with each PR head. No dependency or action upgrade is required now on the evidence available. Recommend merging **none** and closing/deferring **#1–#10**. These are individual major-version update PRs; replace routine future churn with the grouped policy below, rather than combining these majors into a single upgrade.

The inspected PRs were based on initial commit `2439101527ac49670bd8323414814ef084d6a0f1`; local Phase 1 is committed as `50735a5`. Green historical PR checks are useful evidence, not verification of those upgrades against today's application. No candidate branch was applied locally or represented as locally validated.

### Configuration

- Both npm and GitHub Actions remain on a weekly schedule at the repository root.
- Each ecosystem permits one open routine PR and has one group covering minor/patch updates. This bounds routine open PRs at two across the repository; compatible React/runtime/tooling updates can travel together and still require review and CI.
- `allow.update-types` permits only `version-update:semver-minor` and `version-update:semver-patch`. GitHub explicitly documents that this filter does **not** apply to security updates, including fixes requiring a major.
- Groups explicitly apply only to `version-updates`; security updates are not folded into routine groups or constrained by their open-PR limit. No broad ignored version ranges, security-alert dismissals, auto-merge, alternate target branch or workflow-permission changes were introduced.

Policy behavior was checked against [GitHub's current Dependabot reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#update-types-allow) and the YAML was validated against the current [SchemaStore Dependabot schema](https://json.schemastore.org/dependabot-2.0.json). The configuration remains local until a human commits and pushes it to the default branch.

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

Final scope check: `git diff --exit-code -- package.json package-lock.json .github/workflows src tests e2e e2e-model` returned 0 with no differences. Only `.github/dependabot.yml`, `docs/IMPLEMENTATION-LOG.md` and `docs/BUILD-STATUS.md` changed; these are ready for human commit/push. No commit was created in this cleanup.

### Unresolved risks and revisit criteria

- GitHub has not processed the new configuration yet because pushing is prohibited. Schema validation and documentation review are local evidence, not an observed Dependabot scheduling run.
- Repository-level Dependabot alerts/security-update settings were not exposed by the available connector and could not be confirmed; YAML preserves eligibility but cannot enable those settings itself. Keep both enabled in repository settings. No security alert was dismissed.
- The clean npm audit is a point-in-time result and does not prove the Actions bundles are vulnerability-free. [setup-node release notes](https://github.com/actions/setup-node/releases/tag/v6.5.0) mention security overrides for undici/fast-xml-parser; the [upstream advisory page](https://github.com/actions/setup-node/security/advisories) did not establish a TokenLab-specific remediation requirement. The workflows currently do not request package-manager caching. Prioritize an Actions review if an applicable advisory or runner-runtime retirement affects the retained majors.
- Review deferred majors at the next maintenance milestone, or earlier for an applicable security fix, upstream support retirement or a required capability. Security-driven majors must receive an explicit compatibility review; they remain eligible for Dependabot PRs.
- Floating major Actions tags can receive upstream minor/patch changes without a new PR. This cleanup retains that existing choice; it does not establish immutable action pinning.
- For a future npm major migration, run `npm ci`, `npm run verify`, `npm run check:core`, `npm run test:e2e`, and `npm run test:model` where worker/model/build behavior is affected. For Actions, verify both CI artifact behavior and the coordinated Pages workflow within the authorization then available.
