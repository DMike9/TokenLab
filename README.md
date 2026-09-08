# TokenLab

**Interactive experiments in prompt compression and information preservation.**

One prompt. Different experiments. What survives?

TokenLab is a local-first research playground for comparing interpretable prompt transformations against the same original text. It makes the trade-off inspectable: what was removed, why, how the chosen tokenizer changes its count, and whether a measured embedding score or downstream answer also changed.

> **Locally verified development build.** Strict TypeScript, 140 unit tests, 14 mocked gateway tests, 71 pure-engine checks, the production build, six desktop/mobile browser tests and real browser embeddings passed on Windows/Chromium. Independent tiktoken fixtures matched all three encodings. See [BUILD-STATUS](docs/BUILD-STATUS.md) for commands, screenshots, model revision and limits. Live Gemini and deployment remain unverified. No benchmark or state-of-the-art performance is claimed.

## Start

Read [START-HERE](START-HERE.md) for the Windows / VS Code / GitHub walkthrough and [AI-HANDOFF](docs/AI-HANDOFF.md) for the local coding-agent prompt.

```sh
npm ci
npm run verify
npm run dev
```

Node 22.12+ is required. A real verified lockfile is included. The core needs no API key, account, database or Python environment. Browser embeddings are opt-in and require a first public-model/runtime download. `npm run test:model` separately verifies real downloads and inference; it makes no Gemini calls.

## What is implemented in the source

| Experiment | What it actually does | Important limit |
| --- | --- | --- |
| Baseline | Tokenizes unchanged text; inspects IDs, decoded pieces and neighbors | Individual token decoding may be partial UTF-8 |
| Structural minification | Collapses selected repeated whitespace outside protected spans | Formatting can carry meaning; not universally lossless |
| Redundancy | Removes eligible duplicate chunks or n-gram-Jaccard-similar chunks | Similar wording need not mean equivalent information |
| Lexical rules | Applies an explicit small registry of verbose-to-short phrases | Rule-based heuristic, not a learned paraphraser |
| Function-word experiment | Removes a selected English word list from unprotected spans | Destructive experiment, never a recommended prompt by default |
| Importance + math | Scores chunks, transforms scores, applies a threshold and token-budget admission | Hand-designed features and greedy selection, not an optimum |
| Similarity guard | Tries deletions and measures cosine against a fixed original vector | Requires local model; cosine is not task-equivalence proof |
| Weighted hybrid | Exposes positive feature weights and a redundancy penalty | Experimental weighted objective; no learned calibration |

The UI includes original/compressed comparison, visual diff, protection inspection, score explanations, seven transform buttons, ordered chains, a run table, a measured-similarity Pareto view, JSON/CSV export, eight teaching examples and an optional Gemini Arena.

Inspected screenshots from the running application are available for [desktop](docs/verification/desktop-top.png), [mobile](docs/verification/mobile-top.png), and [real embedding results](docs/verification/production-embedding.png).

## Three different things

**Tokenization** maps text to a model vocabulary. **Prompt compression** changes the text to reduce the count. **Semantic compression** attempts to retain task-relevant information and must be evaluated, not inferred from a smaller count. Token IDs are arbitrary labels; their arithmetic is not semantic mathematics.

The BPE adapter uses `gpt-tokenizer` with explicit `o200k_base`, `cl100k_base` and `r50k_base` selection. Counts refer to the raw text, not complete chat-message serialization, hidden instructions, tools, images, reasoning, or a provider bill. Special-looking strings are encoded as literal user text. Words are Unicode-regex word runs; character totals count Unicode code points, not grapheme clusters. Input limits use UTF-16 code units and are labeled separately.

The inspector shows at most 2,000 original tokens, paginated; counts still cover the whole input. It labels UTF-8 **of the decoded text**, not raw vocabulary bytes. Raw-byte inspection is deferred rather than faked.

## Mathematics you can inspect

For nonempty inputs:

```text
retention rate = compressed tokens / original tokens
compression factor = original tokens / compressed tokens
savings percent = 100 * (original tokens - compressed tokens) / original tokens
```

Undefined ratios are exported as null, not infinity. General metric functions allow negative savings; the built-in compression runner rejects token-expanding candidates.

For an importance score x in [0,1]:

```text
linear:       x
square:       x^2
square root:  sqrt(x)
logarithmic:  log(1 + 9x) / log(10)
exponential:  (exp(4x) - 1) / (exp(4) - 1)
sigmoid:      1 / (1 + exp(-k(x-t)))
softmax_i:    exp(x_i/T) / sum_j exp(x_j/T)
```

Softmax is computed with a maximum subtraction for numerical stability. Its cutoff is relative to the uniform mass (cutoff / number of candidates), not the same raw numeric scale as individual transforms. Monotone functions preserve score order; differences here come from thresholding and transformed-score/token-cost greedy admission. They do not create new semantic knowledge. Ties, protection and a binding budget can make several transforms produce identical text; that is a valid result.

The weighted objective normalizes the sum of positive relevance, information, instruction, entity and structure weights, subtracts a redundancy penalty and clips to [0,1]. Its “information” term is based on empirical within-prompt word frequency: `-log2(p(word))`. That is **not** contextual surprisal from an autoregressive language model, and not neural perplexity. See [ARCHITECTURE](docs/ARCHITECTURE.md).

## Embedding measurement

An opt-in Transformers.js worker loads the quantized `Xenova/all-MiniLM-L6-v2` sentence encoder. Its public model revision is resolved and recorded before inference. Prompts are split using the embedding tokenizer into at most 254 content-wordpiece chunks (leaving special-token room). Mean-pooled, normalized chunk vectors are weighted by their content token counts, combined and normalized again. This is an experimental whole-document approximation, not a long-context instruction evaluator.

```text
cosine(A, B) = dot(A, B) / (norm(A) * norm(B))
```

Dot product, Euclidean and Manhattan distances are also exposed. For normalized vectors, dot equals cosine and squared Euclidean distance is `2 - 2*cosine`; these are not independent confirmations. Empty/unencodable/too-long model inputs yield missing measurements or explicit errors, never a prefix-only score. Long-document pooling can dilute critical facts, negate relational information, and miss logical changes. The encoder is primarily intended for English sentence similarity.

**Embedding similarity is a proxy for semantic preservation, not proof of identical LLM behavior.** The Pareto frontier is therefore only a frontier in the displayed proxy coordinates. It does not mean “best prompt.” Rows without measured similarity do not become chart points.

## Guardrails and limits

Detected negations, numeric strings, exact user-protected text, instructions, quotes, code, some identifiers/entities and structural Markdown are protected. This detector is intentionally conservative but incomplete. Whole valid JSON is protected verbatim; semantic JSON rewriting is not implemented. Every stage re-checks original protected string occurrences. Occurrence retention does not prove that relationships, every entity, or every instruction was detected and preserved.

If protection requires more tokens than the target, the result explicitly says the budget could not be met. Candidate budgets use actual tokenization of the reconstructed text, not the sum of individual chunk counts. The selector is greedy and can leave budget unused.

The maximum input is 60,000 UTF-16 code units. Additional method-specific chunk limits keep browser work bounded: redundancy 1,500; importance 512; model-assisted hybrid 64; similarity guard 96; embedding aggregation 128 windows. Some long inputs can be counted but cannot use every method. Limits yield errors rather than silently dropping the rest of the input.

Independent runs always start from the original. Chains run the selected operations in order. A budget-consuming stage's percentage is relative to **that stage's input**; applying budget selection twice can compound reductions. Final counts/diff/similarity still compare with the original. Score explanations belong to the last stage, as labeled.

## Reproducibility and privacy

Runs record engine version, method sequence, tokenizer encoding, settings, input/output SHA-256, timestamp, results and, when present, the model ID/resolved revision/dtype/aggregation. The dependency pins and a verified committed lockfile identify the implementation environment. For serious benchmarking also record browser, hardware, runtime, commit and model response versions.

Prompt history and embeddings are kept in memory; refresh/clear removes session data. Public model files/manifest may be cached. No telemetry or prompt persistence is added. Hosting providers still receive normal asset requests; Hugging Face receives model-download requests, not prompt inference inputs. Offline reload is not guaranteed: there is no service worker installation flow.

JSON export excludes original/compressed prompt text and protected custom strings by default. Explicit text export includes them. Hashes, parameters, snippets you choose to export and model responses can still be sensitive; hashing is **not** anonymization. CSV export guards against formula injection. Exported results are not automatically uploaded.

## Optional Gemini Arena

`server/gemini.mjs` is a local-only native Node gateway. Store the key in an ignored `.env.local`; never use `VITE_GEMINI_API_KEY`. The browser requires explicit permission to send the selected prompt pair to Google. The gateway uses Google's supported `generateContent` REST endpoint, not an agent that executes tools. Both calls use the same configured model, temperature 1 and output cap; usage comes from provider metadata.

A supplied reference uses exact trimmed-text or canonical JSON equality. Without a reference there is no correctness score. Same outputs can both be wrong. A single sequential pair is not a controlled benchmark, and generation/latency can vary. Safety blocks, truncated outputs, model updates and failure after one paid call must be considered. No actual Gemini calls were made during authoring.

The gateway binds only to loopback, checks Host/Origin, requires JSON and a custom request header, caps body size/concurrency and permits at most six pairs per minute. These are local-development safeguards, **not** public-service authentication or a guaranteed spend cap. Do not expose it through a public tunnel. GitHub Pages deploys only the keyless browser app.

## Research and next steps

The project is an interpretability/education layer and a comparison harness, not a claim to outperform LLMLingua. The [research notes](docs/RESEARCH.md) distinguish our first-principles heuristics from perplexity-driven LLMLingua, query-aware LongLLMLingua and token-classification-based LLMLingua-2.

An optional Python/FastAPI LLMLingua adapter, stronger entity/schema protection, immutable model fixtures, downstream benchmark suites, per-token neural surprisal, richer byte inspection and a validated composite score are **not implemented** in this version. See [ROADMAP](docs/ROADMAP.md). No Python dependency is needed until that adapter is actually added.

## Project map

```text
src/engine/        strategies, protection, chunking, scores, math, metrics, diff, export
src/tokenizer/     lazy browser BPE adapters and token inspection
src/similarity/    model loading and full-input embedding aggregation
src/workers/       worker message execution
src/components/    charts, token inspector, optional Gemini comparison
server/            local Gemini gateway and HTTP mock tests
tests/             pure scenarios and real-package tokenizer integration tests
e2e/               browser smoke tests (no paid calls)
docs/              product spec, research, architecture, build status, handoff
.github/workflows/ verification and manually triggered Pages deployment
```

## Tests

```sh
npm run check:core       # dependency-injected pure engine; character counter is a test seam
npm test                # same engine scenarios plus actual installed BPE integration
npm run test:gateway     # local HTTP tests with mocked Google responses; no charges
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e         # actual app/browser; no Gemini or model downloads by default
```

MIT-licensed TokenLab code. Dependencies and model artifacts retain their respective upstream terms. Sources, licenses and credits are in [RESEARCH](docs/RESEARCH.md). Do not imply endorsement from OpenAI, Microsoft, Google, Hugging Face or any university.
