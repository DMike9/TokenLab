# Architecture and explicit design decisions

## Execution path

React creates a settings snapshot and sends a request to a dedicated browser worker. The worker lazily loads the selected tokenizer, optionally prepares the local embedding model, and invokes the modular strategy engine. It returns measurements and decision records. React renders the records; it does not invent salience or similarity values.

Each strategy implements the shared `Strategy` interface: ID, name, description, optional warning and asynchronous `compress(text, context)`. The context injects exact token counting, settings and optional embedding inference. This separation permits pure tests without pretending a character counter is a production tokenizer.

One worker queue processes requests serially. Cancellation terminates the worker and its model state. The optional Node gateway is a separate process and has no role in keyless experiments. The Vite dev/preview proxy routes only `/api` to it.

## Scoring

Chunks retain exact character offsets and original order. Split candidates are punctuation/line boundaries outside protected spans. No whitespace is silently reconstructed from a bag of tokens.

For each chunk:

- Relevance: cosine of lexical frequency vectors against the last nonempty chunk by default; local embedding cosine in model-enabled hybrid mode. The anchor assumption is visible and may be wrong.
- Information: mean empirical word-frequency surprisal normalized by log2(total word occurrences).
- Instruction/entity/structure: detected feature indicators, not complete linguistic labels.
- Redundancy: maximum bigram Jaccard similarity against an earlier chunk, therefore position-sensitive.

The pasted product brief has a mixed-sign/bulleted hybrid formula. This implementation makes a **documented engineering interpretation**, not a literal correction: five positive feature terms divided by their positive weight sum, minus lambda times redundancy, clipped to [0,1]. Zero positive weights produce zero positive score. The engine does not claim an optimal or trained objective.

All protected chunks are retained first. Eligible candidates must pass the selected transformed-score cutoff. Others are attempted in descending transformed-score / isolated-token-cost order; each admission re-tokenizes the entire reconstructed text. There is no claim to solve a global knapsack optimum. Encoding boundaries mean isolated costs are ordering heuristics only.

## Protection

Detection returns inspectable reason-tagged spans. Transformation routines may only modify unprotected gaps. Span merging is used for slicing; reason/occurrence records are used for retention metrics. Protection catches common patterns but is not a parser, NER model or proof system. The final runner checks original occurrences after every stage and rejects expansion. Whole JSON protection is deliberately blunt.

Protecting a word string alone does not prove the same sentence relationship or referent survived. Adding an exact entity name manually protects that string, not every statement about it. Numbers and dates may be detected as multiple protected pieces rather than parsed semantic units.

## Embedding path

Resolve an actual Hugging Face commit SHA, load that revision with Transformers.js on WASM/q8, then tokenize each input with the embedding model's tokenizer. At most 254 content tokens are admitted per window; every original code point is traversed. Model-token-weighted pooling is explicitly recorded and has major semantic limitations. Metadata/runtime/model files can be fetched; prompt text stays in the worker.

Semantic guard compares each proposed deletion to a fixed vector for its stage's original input, not only to the preceding accepted candidate. Final experiment similarity compares the pipeline output with the very original prompt. An error stays an error; no lexical fallbacks under the “semantic” label.

## Metrics / export

Standalone metrics define edge cases explicitly. Empty ratios use null. Similarity requires nonzero, equal-dimensional finite vectors. Token counts are for raw selected-encoding text. Timing separates the compression call sequence from the total measured run; warm caches and downloads affect timings. Do not compare these numbers as controlled hardware benchmarks.

The comparison table is filtered by original text and encoding. The Pareto plot includes only measured similarity rows and compatible model revision/dtype. Run exports include all in-memory rows and hashes, and omit raw text by default. Import/replay of experiment files is a future feature.

## Gemini security boundary

The browser never receives a key. A loopback-only native Node server reads `GEMINI_API_KEY` and `GEMINI_MODEL`, validates local requests, and makes at most two text-generation calls per comparison. It sends the original and compressed prompts separately, with identical generation settings, without injecting the reference answer. It returns visible answer text, provider token usage, provider model version when reported, finish reason and local elapsed time.

There is no tool use, command execution, remote URL supplied by the client, arbitrary API proxying, prompt logging, persistent database or automatic retry. A retry must be a deliberate new user request and might cost more. Local rate limits are not sufficient for a public service. Phase 2 public API use requires separate authentication, authorization, quotas, abuse controls, billing governance and an explicit privacy policy.

## Intentional scope decisions

This source contains the core engine/UI and an optional local Gemini harness. It does not contain a trained compression model, a Python LLMLingua runtime, production cloud infrastructure, NER guarantees, a proof of semantic preservation, a fabricated composite quality score, real benchmark results or a claim of a rendered/verified release. See BUILD-STATUS.
