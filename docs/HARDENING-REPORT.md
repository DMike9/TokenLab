# TokenLab Hardening Report

## Scope

Post Phase 2 hardening only, 2026-09-09. No paid calls, deployment, push, or Phase 3 work. Synthetic attack cases are regression tests, not benchmark results. Recommendation: **PASS for the experimental local application**, subject to the explicitly unverified environments below. No unresolved Critical or High defect was found in the reviewed paths.

## Architecture reviewed

Source inspection: React App owns editor/draft controls, analysis, selected result and 100 in-memory runs. `useLab` correlates promises to a dedicated module worker. The worker serializes analysis, model initialization and run requests. The runner uses actual lazy BPE adapters, resolves original task focus, runs ordered strategies, checks original protected occurrences and full-string counts, then measures optional final similarity. React computes display diff and protection markup from recorded result text; exports are generated locally.

Trust boundaries: pasted text is untrusted data rendered by React; worker messages are same-origin internal requests, not authenticated remote messages. Transformers.js downloads public metadata/model/runtime assets and performs prompt inference locally in WASM. Model outputs need numerical validation. Browser cache contains public model files; prompt/vector/history caches are memory only. Optional separate native Node gateway checks local Host/Origin/custom header/body/rate/concurrency and sends two explicitly authorized prompts to a fixed Google endpoint. Its injected fetch is a mock-test seam, never a production browser fallback. Exports/clipboard intentionally cross the local session boundary. Dependencies and Actions are supply-chain inputs.

## Threat / failure model

Attack malformed text, conservative detector gaps, settings mutation across awaits, cancellation/late worker events, unsupported resource sizes, invalid numerical inputs, model failures, misleading evidence, export leakage, gateway protocol/provider failures and repository artifacts. This is a local experimental tool, not a hostile-local-process isolation boundary or a public authenticated service.

## Findings

Counts: **0 Critical; 2 High; 5 Medium; 5 Low. All twelve findings repaired.** Severity describes the observed defect/advisory, not a claim that the local browser application was remotely exploitable.

### H01 — High — Dependency advisory

Observed: clean installation/audit reported two High entries: `sharp` and its dependent Transformers package. Risk: vulnerable native image decoding dependency; the browser text-embedding path does not use sharp. Reproduction: `npm ci`, `npm audit --json` with sharp 0.35.3. Fix: existing override changed only to 0.35.4; npm regenerated its native/libvips lock entries. Regression/verification: clean install, native synthetic 2×2 PNG smoke, full build/model suites and zero-vulnerability audit. Residual: point-in-time audit, not proof of supply-chain safety. [Upstream advisory and affected/patched versions](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), [release](https://github.com/lovell/sharp/releases/tag/v0.35.4).

### H02 — High — Adjacent instruction detection

Observed: consuming sentence delimiters caused adjacent instruction clauses to be missed; leading spaces could also defeat detection. Risk: eligible instruction words could be removed despite apparent instruction protection. Reproduction: ` Write a report. Return only JSON. Explain the result.` lacked an explicit-instruction span for every clause. Fix: non-consuming boundary lookbehind and explicit leading-whitespace handling. Regression: `instruction detector covers adjacent clauses and leading indentation`, plus corpus execution under all encodings. Residual: English imperative patterns are incomplete; implicit/distributed instructions and questions still need inspection/custom protection.

### H03 — Medium — Custom occurrence accounting

Observed: `aba` in `ababa` detected only offset 0; repeated declarations created duplicate records for that offset. Risk: overlapping occurrences were underprotected and duplicate declarations could falsely fail identity retention. Fix: literal `indexOf`, advance one UTF-16 position, deduplicate declarations; retention counts overlapping matches. Regression: offsets [0,2], identity rate 1, removal rate .5, regex-looking/quoted/bracketed/multiline/Unicode custom strings, case sensitivity. Residual: the UI's one-term-per-line editor cannot express a multiline term; the engine supports one. No regex execution is used for custom text.

### H04 — Medium — Identifier ablation

Observed: function-word ablation changed `the-file.ts and a-variable` to `-file.ts and -variable`. Risk: corrupted code/file identifiers. Fix: conservative dotted/kebab/camel identifiers and filename spans; signed/currency/percentage numeric matches also retain their contiguous spelling. Regression: explicit identifier-output check and structured/code/identifier corpus. Residual: ordinary hyphenated prose can be overprotected; this is neither a parser nor complete NER. Single proper names, unfamiliar scripts and unsupported structures can remain undetected.

### H05 — Medium — Async evidence/state ownership

Observed: the runner cloned settings only at return and held the caller's methods array; mutating either immediately after invocation changed completed evidence. UI cancellation/clear rejected pending promises without invalidating their catch/finally continuations, and old worker progress/errors lacked an identity check. Risk: settings/result mismatch or old status/busy/model state overriding new intent. Fix: clone at entry; synchronous UI lock, operation generations, worker identity/request checks, explicit message-decoding errors and reset of embedding enablement on fatal worker failure. Regression: immutable entry snapshot; rapid duplicate clicks; cancel/clear/new run; deliberately late progress/error/model-ready messages; visible failure and worker restart. Residual: fault tests deliberately inject transport timing; model inference is verified separately. Cancellation destroys model state and requires reinitialization.

### H06 — Medium — Numerical/model-output validation

Observed: NaN sigmoid parameters could produce NaN scores; baseline accepted nonfinite unused controls; vector normalization accepted some invalid inputs and pooling did not validate each model window. Risk: invalid recorded numbers or concealed model failures. Fix: validate complete run settings; validate finite features/weight sums; clip analytical feature bounds after roundoff; avoid cosine-denominator underflow for tiny nonzero vectors; reject vector overflow, zero/nonfinite vectors and non-384-dimensional windows before pooling/cache. Regression: nonfinite controls, numerical boundaries, contribution reconciliation, injected initialization/vector failures and real normalized embeddings. Residual: these checks establish numerical validity, not semantic validity; raw math helpers are not a hostile-code sandbox.

### H07 — Low — Export defenses/default reset

Observed: CSV escaping omitted whitespace-before-formula prefixes; CSV could spell Infinity; the in-memory JSON builder retained nonfinite numbers until serialization; session clear retained text-export opt-in. Risk: misleading exports and accidental text inclusion in a later session. Fix: escape formula markers after leading whitespace, use null/empty numerical exports, reset opt-in on clear. Regression: schema 2, every-stage redaction, quotes/commas/newlines/Unicode/formula fields, nonfinite values, clear reset and both browser scopes. Residual: malicious CSV IDs require an externally constructed Run in this version; normal IDs are generated UUIDs. Hashes and metadata can identify prompts; redaction is not anonymization.

### H08 — Medium — Maximum-input responsiveness/paste

Observed: chunking 60,000 code units as 30,000 protected lines took 5,795 ms through repeated full-span scans. Native Chromium insertion of that many lines stalled the browser automation; assigning the same controlled value completed in about 197 ms. The HTML maxlength also allowed oversized native pastes to be clipped without a useful error. Fix: sorted span traversal, visible oversize rejection, and one controlled paste update with native textarea CRLF/CR normalization. Regression: dense-input reconstruction/protection, all resource boundaries, actual clipboard Ctrl+A/Ctrl+V at MAX and MAX+1. Local chunking after repair: 22.6 ms. Residual: large text, many decisions and caches still consume memory; observations are local, not performance benchmarks. Synthetic Playwright `fill` is not used to misrepresent the repaired clipboard path.

### H09 — Low — Token inspector evidence/accessibility

Observed: the last capped token labeled its uninspected next neighbor as `end`; pagination buttons had only arrow glyph names, and unusual token text could have a poor accessible name. Risk: mistaken document boundary and ambiguous controls. Fix: `outside inspection cap`, named page controls and explicit token/index/ID/decoded-text names. Regression: 1,999/2,000/2,001 totals, page traversal to index 1,999 and unavailable-neighbor label. Residual: raw vocabulary bytes remain unavailable; individual decoded pieces can contain replacement characters.

### H10 — Low — Zoom overflow

Observed: 200% content zoom made result metrics expand the document to 1,510 px in a 1,440 px viewport. Fix: metric columns fit their available width. Regression: keyboard result workflow and no page-wide overflow at 200% content zoom; inspected actual captures at all requested sizes. Residual: content zoom is not a claim of native browser-chrome zoom or full WCAG conformance; physical devices and manual screen readers remain unverified.

### H11 — Low — Gateway schema/error handling

Observed: unexpected request properties were silently ignored; malformed provider structures could throw a generic internal 500 rather than an explicit upstream 502. Risk: confusing protocol failures and weaker request contracts. Fix: reject unexpected request properties; validate primary upstream response/parts shape; only accept nonnegative safe-integer usage counts. Regression: 20 mocked HTTP tests including protocol limits, concurrency/rate limits, upstream failures, malformed bodies, second-call failure, safety blocks and missing usage. Residual: local service only; no public authentication or guaranteed billing cap. A failed second call does not undo the first call or preserve a complete partial-pair artifact.

### H12 — Low — Restored-stage budget metadata

Observed: the final guard set budget status to null after rejecting a budgeted candidate, leading to a misleading “not applied” label. Fix: recompute restored text against that stage's target and explain restoration in the UI. Regression: injected expansion/protected-occurrence loss must restore original text, retain a visible note and report the infeasible budget. Residual: per-stage notes/counts/decisions are recorded; the top-level status still describes the final stage only.

## Adversarial cases executed

`tests/hardening-corpus.ts` has 21 synthetic cases, exercised through seven non-model-required strategies and all three real BPE encodings: **441 runs**. Cases cover logical qualifiers, signed/decimal/currency/date/time/version/leading-zero/phone-like numbers, names/acronyms/identifiers/UUIDs/files, valid/nested/malformed JSON and XML/YAML-like text, Markdown/table/list/fence/inline/quotes, Python/TS/SQL/shell/regex/indentation, URLs/query/fragment/email, emoji/ZWJ/accent/combining/Chinese/Arabic/RTL/zero-width/unusual whitespace/lone surrogates, special-looking tokens/control characters/short/empty/whitespace, task-first/middle/last, repeated instructions, quoted negation and long distractors. They prove implementation invariants for these cases, not downstream correctness.

Each completed corpus run checks original identity, exact full-string counts, nonexpansion, occurrence retention, budget implications, finite evidence and both diff reconstructions. Additional tests cover chain order, repeated execution, manual overlaps, all seven transforms, zero/max/individual weights, cutoff 0/1, budget 10%/100%, temperature .05/2, steepness 1/20, center 0/1, ties, invalid settings and empty candidate sets. Existing scoring tests isolate every feature; none were removed or relaxed. Auto's earliest tie, questions, multiple candidates, explicit fallback, stale user choice, opaque data exclusion and legacy anchor remain covered. Expected answers only enter the optional Arena/gateway path; compression/focus have no reference-answer input.

## Security/privacy review

Reviewed public tracked source/config/documentation and intended new files; credential-pattern scanning reports only paths/counts, never matches. No tracked secret paths or historical `.env` paths beyond the excluded template were found. No secret/environment file contents were opened. This is a scoped hygiene scan, not a guarantee that arbitrary secrets cannot be encoded in history.

Core source has no localStorage/sessionStorage, IndexedDB prompt store, telemetry, analytics, unsafe HTML insertion or remote inference submission. React renders prompt/response text as text. The XSS attack generated no external requests or executable image node. Model network instrumentation saw no external non-GET/body-bearing requests in successful real-model tests. The explicit Arena is the only prompt-transmitting path. Download object URLs are revoked; clipboard write is deliberate. External links use `noreferrer`. Map-based text statistics avoid prototype-key interpretation; unexpected gateway fields are rejected. Public model manifests/assets may remain in browser caches after clear.

Gateway remains bound to `127.0.0.1:8787`, checks local Host and Origin plus a custom header, rejects non-JSON, limits body to 180,000 bytes and each prompt to 20,000 code units/reference to 4,000, serializes pairs and limits six pairs per rolling minute. Provider exceptions/bodies are sanitized. Timeout behavior uses an injected failing fetch; no 60-second live-provider timeout or paid call was performed. Native Node request/header timeouts and the sequential first/second-call caveat remain. No exposed public API was added.

## State/concurrency review

Worker queue serialization is paired with UI operation ownership. Disabled prompt/example/tokenizer/focus/view/slider controls prevent draft changes during a run; immediate repeated click events encounter the synchronous lock. Old worker callbacks cannot resolve current promises or terminate the replacement worker. Cancel/clear invalidate continuations before rejection; a new run can start immediately. Earlier history survives ordinary example/view changes, filters by original+encoding, and never gains retrospective embedding scores. Completed settings are detached from the caller. The UI does not mutate recorded runs; this is ownership-based immutability, not a recursively frozen JavaScript object.

## Mathematical/numerical review

The engine owns the formula: five weighted positive features divided by their positive weight sum, minus weighted redundancy, clipped to [0,1], then transformed. Zero positive weights give zero positive terms. Contributions reconcile to raw score within floating-point tolerance; displayed components are rounded. Monotone transforms preserve fixed score ranking; cutoff and transformed-score/isolated-cost admission can change retained output. Every admission recounts the entire assembled string. Softmax is normalized across the recorded chunks and is not calibrated task-importance probability. No global optimum, perplexity, task-preservation or composite-score claim was added.

## Tokenizer review

Actual gpt-tokenizer 4.0.0 declarations and package exports were inspected. Existing **36** Python tiktoken fixtures pass. Added **12** independently generated tiktoken 0.14.0 fixtures for controls, bidi/ZWJ/combining text, long whitespace and malformed surrogates; exact IDs and decoded output pass in all three encodings. UTF-8 replaces lone surrogates; the editor/result strings are not rebuilt by concatenating partial token decodes. Count/inspector-cap/encoding-switch regressions pass. Fixture parity is evidence for tested strings, not an exhaustive proof over every possible string.

## Embedding review

Real tests use Xenova/all-MiniLM-L6-v2, resolved revision **751bff37182d3f1213fa05d7196b954e230abad9**, q8, WASM, Transformers.js 3.8.1. Public download, initialization, normal/hybrid/guard inference and full long Unicode input pass. Long common-prefix/different-tail strings produce 7 and 5 windows, 384-dimensional normalized finite vectors and cosine approximately 0.524621; identical cached text returns the same vector. This rules out prefix-only processing for this test. Successful instrumented paths record no model/CORS/ONNX/worker/console errors. Model-unavailable, not-requested/empty comparison and failed measurement have distinct visible paths; scores are never replaced with lexical similarity.

Window boundary tests at 127/128/129 use an explicitly labeled counter seam, while actual model tests verify full multiple-window inference. Injected initialization/vector failures verify error behavior and retry; a blocked Hugging Face request is also tested in the browser. The test seams are never used as real model evidence. Pooling and the primarily English encoder remain proxies that can miss negation/relationships and dilute tail facts. Model revision resolution depends on public metadata or its cache; offline first use remains unverified.

## Export review

JSON schema remains 2. Default redaction removes original/compressed strings, protected custom terms, focus text and every stage's decision text. Both current-prompt/encoding and full-session scopes are exercised; text requires opt-in and clear resets it. CSV is text-free and escapes formula-like fields, quotes, commas and newlines. Hashes and scoring/settings evidence are retained deliberately with a non-anonymization warning. Nonfinite numerical values are null/empty. No import/replay, benchmark artifacts or invented experiment rows were introduced.

## Accessibility review

Executed keyboard tab roving, Left/Right/Home/End, Enter/Space activation, focus into active panels, contribution disclosure, token pagination, and real measured chart-point Space activation. Hidden Research controls remain outside keyboard navigation; busy controls are disabled. Errors/status use live regions; token/page names are explicit. Captures at 1440×1000, 1024×768 and 390×844 include long URLs/code/contributions, with no page-wide overflow. Internal table/result scrolling is intentional. 200% content zoom is checked separately and identified as such. Native browser UI zoom, manual screen-reader testing, complete contrast/tap-target audit and WCAG conformance are **unverified**; small dense research text remains a usability limitation.

## Repository/supply-chain review

Node 24.15.0/npm 11.12.1 were used; declared minimum remains Node 22.12 and `.nvmrc` remains 22. Package-lock root version matches package.json 0.1.0; engine evidence version is separately 0.2.1. Only the sharp patch/native runtime graph changed. No account-wide Git settings, remote mutations or deployment were performed. Generated caches/results/build/Python environments are ignored; curated screenshots/compact measurements are retained intentionally.

Actions were pinned without crossing a major. For every row, `git ls-remote` against the named official `actions` repository verified both the original floating tag and the exact release tag resolve to this commit. YAML parses and permissions were inspected; CI-equivalent local checks pass. Remote CI/Pages jobs were not executed. Pages retains write/id-token privileges for its manually dispatched deployment; verification has read-only contents permission. Dependency installation now requires `npm ci` rather than falling back to an unlocked install.

| Action | Original | Verified release | SHA |
| --- | --- | --- | --- |
| checkout | v4 | v4.4.0 | 11d5960a326750d5838078e36cf38b85af677262 |
| setup-node | v4 | v4.4.0 | 49933ea5288caeca8642d1e84afbd3f7d6820020 |
| upload-artifact | v4 | v4.6.2 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| configure-pages | v5 | v5.0.0 | 983d7736d9b0ae728b81ab479565c72886d7745b |
| upload-pages-artifact | v3 | v3.0.1 | 56afc609e74202658d3ffba0e8f6dda462b719fa |
| deploy-pages | v4 | v4.0.5 | d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e |

Dependabot policy is unchanged. Upstream bundled Action dependencies and repository alert/private-reporting settings are not fully audited by npm audit; pinning does not prove those bundles vulnerability-free. Current docs now point to the hardening evidence; historical counts/reports remain clearly dated. Obsolete “unpublished/not pushed” current-status claims were removed without making a new remote/deployment claim.

## Test-integrity review

The initial new hardening suite produced **7 failures / 5 passes** before repairs. Regressions assert outputs/IDs/restoration/redaction rather than merely successful calls. The corpus is intentionally broad in one test per encoding instead of inflating counts per string/method. Existing 71 character-counter contracts remain labeled test seams; independent BPE fixtures and real model/browser tests are separate. Transport/model fault injection is explicitly labeled. No assertions were weakened or existing tests removed.

New settings validation initially exposed tiny floating-point feature overshoot; the analytical bounded features are now clipped at their source, and strict numerical assertions remain. The first expanded browser run found zoom overflow and the native insertion stall; the clipboard regression now exercises actual clipboard paste and preserves the original maximum-size assertion. Windows clipboard CRLF normalization was repaired to match textarea behavior. Clean install initially hit Windows EPERM on an active esbuild executable; stopping this workspace's dev/esbuild process allowed `npm ci` to pass. One redundant concurrent model rerun was interrupted after its separately owned test server shut down; final suites use a stable local server. These are recorded failures/setup issues, not hidden passing results.

## Mutation evidence

Seven temporary source mutations each made the focused test fail: remove `not` detection; bypass budget admission; reverse Auto's tie-break; add one to tokenizer count; expose focus text in redacted JSON; suppress method-change detection; bypass final occurrence/expansion guard. The script restored exact original file bytes in a `finally` block after every mutation and checked their hashes. The final suite passes with safeguards restored. Only compact detection evidence is retained; no temporary broken source or mutation framework is committed.

## Performance/resource observations

Limits tested at MAX−1/MAX/MAX+1: overall 60,000 code units; redundancy 1,500 chunks; importance 512; model hybrid 64; guard 96; embedding 128 windows; token inspector 2,000. Limits throw useful errors rather than silently truncating. Actual overall and inspector checks use BPE; method-limit tests use BPE counting and explicit vector seams where needed. Maximum dense input is also pasted/analyzed in Chromium. Diff retains its bounded LCS/coarse-reconstruction fallback. Sorted chunk-span traversal reduced the standalone dense-input observation from 5,795 ms/~17.7 MiB heap to 22.6 ms/~20.5 MiB heap. These are one-off local Node observations, not comparative performance benchmarks or whole-app memory guarantees.

## Remaining known limitations

Protection/focus are conservative English heuristics, not NLP/NER completeness or task-preservation guarantees. Entire valid JSON is retained; unfenced languages/implicit instructions may be missed; overlapping exact strings say nothing about relationships. Legacy means original final-chunk anchoring, not an entire older engine. Similarity remains an English sentence-model pooling proxy. 128-window boundary tests are seams, not 128-window real inference stress. Raw vocabulary bytes, replay, trained compressors, benchmarks and composite score remain deferred. Hashes can identify known prompts and malformed UTF-16 strings can share a normalized UTF-8 hash. Native browser zoom, manual screen readers, other browsers/devices, offline first use, remote CI/Action runtime and deployment are unverified. Live Gemini remains deliberately untested; local gateway guards are not public-service security.

## Hardening gate recommendation

**PASS — SAFE TO COMMIT/PUSH after human review of this local change set.** This is a recommendation, not authorization or evidence of a push. No unresolved Critical/High defect is known from the audited paths; the medium/low residual scientific and environment limitations above are acceptable for the explicitly experimental local tool. See [BUILD-STATUS](BUILD-STATUS.md) for exact commands/results and [curated evidence](verification/hardening/evidence.json). Do not begin Phase 3 or deploy based solely on this report.
