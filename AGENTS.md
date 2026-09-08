# TokenLab coding-agent instructions

You are working in an existing React/TypeScript/Vite research project. Implement and repair real code; do not replace it with a scaffold, a mock dashboard, generated screenshots, or pseudocode.

## Start

Read `START-HERE.md`, `docs/BUILD-STATUS.md`, `docs/ARCHITECTURE.md` and `docs/PRODUCT-SPEC.md`. The author's pure-engine and gateway checks passed, but package downloads were blocked: integration and browser checks remain necessary. Do not assume “written” means “verified.”

Use this project folder only. Never read, print, commit or exfiltrate `.env.local` or other secrets. The user configures keys manually. Never place keys under a `VITE_` variable. Do not change account-wide Git settings or publish/deploy without user authorization.

## Execution

1. Inspect package.json and use a supported Node version. Install dependencies (generate a real lockfile), inspect actual installed declarations, and repair API/type mismatches.
2. Run `npm run verify` and `npm run check:core`; fix causes, not assertions. Tests may not be removed or relaxed just to make a command green.
3. Install Playwright Chromium and run `npm run test:e2e`. Launch and inspect desktop and mobile rendering, console errors, token inspection, Unicode, budget constraints, export, chain history and all example prompts.
4. Verify the actual BPE library's exact output against an independently generated tiktoken fixture before claiming full encoding parity. Character counters in pure tests are explicitly test seams, not tokenizers.
5. Enable actual browser embeddings, inspect download/CORS/ONNX/worker errors, verify that full long inputs are chunked without prefix-only truncation, and record a real model revision. Do not substitute lexical similarity for an embedding metric.
6. Gemini tests mock Google intentionally. Do not make real paid calls or inspect keys without the user's explicit authorization. Keep live tests separate from regular CI.
7. Run dependency auditing. Resolve issues thoughtfully; do not perform blind forced major upgrades. Commit package-lock.json after a successful install and verification.
8. Update BUILD-STATUS with the exact commands and results. Screenshots must come from the running application, not fabricated images. Leave failures visible and explain real environment blocks.

## Scientific invariants

Every independent operation starts from the original. Chaining is explicit. Count full resulting strings with the selected BPE encoding; never add isolated chunk token counts and call that exact. Protect original occurrences across every pipeline stage. Never manipulate vocabulary IDs as semantic numbers.

Monotone transforms alone cannot reorder a fixed ranking. This implementation uses numeric cutoffs and transformed-score/token-cost greedy admission; explain those decisions. Do not claim global optimality, task preservation, novel state of the art, neural perplexity, or guarantees from a proxy.

Similarity must be measured with the named local embedding model and resolved revision or reported as missing. Do not fill tables/charts with fake experiment results. No “TokenLab score” without a documented and validated rationale; leave the composite score deferred.

## Architecture

Keep React separate from `src/engine`, tokenization, model inference and the optional Node gateway. A worker handles browser experiments. Do not add accounts, a database, Docker, cloud infrastructure or paid hosting for the core. Any LLMLingua adapter must remain optional, credit its upstream implementation, and expose its actual model/version/runtime. The Python adapter is not implemented yet.

## Definition of a locally verified build

Actual dependency installation; strict TypeScript check; all actual Vitest and gateway tests pass; Vite production build succeeds; browser flows pass and screenshots are inspected; real embedding behavior is checked or clearly marked blocked. Passing unit tests alone is insufficient. Summarize exactly what works, what remains, and the next user action.
