# Architecture and explicit design decisions

## Execution path

React creates a settings snapshot and sends a request to a dedicated browser worker. The worker lazily loads the selected tokenizer, optionally prepares the local embedding model, and invokes the modular strategy engine. It returns measurements and decision records. React renders the records; it does not invent salience or similarity values.

Each strategy implements the shared `Strategy` interface: ID, name, description, optional warning and asynchronous `compress(text, context)`. The context injects exact token counting, settings and optional embedding inference. This separation permits pure tests without pretending a character counter is a production tokenizer.

One worker queue processes requests serially. Cancellation terminates the worker and its model state. The optional Node gateway is a separate process and has no role in keyless experiments. The Vite dev/preview proxy routes only `/api` to it.

## Hard constraints, task focus and soft importance

Chunks retain exact character offsets and original order. Split candidates are punctuation/line boundaries outside protected spans. No whitespace is silently reconstructed from a bag of tokens.

For each chunk:

- Relevance: lexical frequency-vector cosine against the resolved original task focus; local embedding cosine (clamped to [0,1]) only in model-enabled hybrid mode. A focus is an experimental assumption, not task correctness.
- Information: mean empirical word-frequency surprisal normalized by log2(total word occurrences).
- Instruction signal: imperative/request-like language or a question mark, observed directly from chunk text.
- Entity signal: numeric characters, acronyms, underscore identifiers, URLs or a capitalized word after the first word. This is a weak named-item indicator, not NER; it misses sentence-initial single names and can flag ordinary capitalization.
- Structure signal: headings, list/table/indentation markers, fences, tags, JSON-like starts or a short line-start label ending in a colon. The label case can apply to eligible content; it is not a schema parser.
- Redundancy: maximum bigram Jaccard similarity against an earlier chunk, therefore position-sensitive.

The pasted product brief has a mixed-sign/bulleted hybrid formula. This implementation makes a **documented engineering interpretation**, not a literal correction: five positive feature terms divided by their positive weight sum, minus lambda times redundancy, clipped to [0,1]. Zero positive weights produce zero positive score. The engine does not claim an optimal or trained objective.

All protected chunks are retained first. Eligible candidates must pass the selected transformed-score cutoff. Others are attempted in descending transformed-score / isolated-token-cost order; each admission re-tokenizes the entire reconstructed text. There is no claim to solve a global knapsack optimum. Encoding boundaries mean isolated costs are ordering heuristics only.

### Task focus from the original prompt

`engine/taskFocus.ts` resolves one exact original slice under a versioned `task-focus-v1` policy:

- **Auto (default):** rank nonempty original chunks by imperative language (+4), question mark (+3), request-like language (+2), and existing protected-instruction detection (+1). Ties choose the earliest original chunk. Code-fence, inline-code, valid-JSON and quoted-string chunks are excluded conservatively, even when they contain other instruction-like prose. All positive candidates and reasons are recorded and inspectable.
- **User selected:** Research offers the original chunks directly, with no second prompt/query box. The selected identifier combines chunk index, original UTF-16 offsets and a non-cryptographic content fingerprint. If an edit or protection-boundary change invalidates the choice, the preview and run explicitly record the fallback instead of silently choosing another task.
- **Legacy final chunk:** choose the final nonempty original chunk, exposing the previous anchor assumption. Auto without a credible candidate and an invalid user selection explicitly fall back to this policy. Empty/whitespace-only input records `empty-input`, with no focus.

The runner resolves focus once before any operation, records its SHA-256, and holds it fixed throughout a chain. An earlier operation can remove or rewrite an eligible focus chunk; later scoring still compares with its original text. Selecting focus does not add protection. Legacy here compares the old *anchor rule*, not a bit-for-bit Phase 1 scorer: soft features are now independent, and chain stages no longer silently re-anchor to their changed input.

Chunk indexes include whitespace-only slices, so displayed indexes may skip between text-bearing options. Offsets and identifiers refer to the original chunking under the recorded protected terms. No expected/reference answer enters focus detection or compression. Auto is an English surface heuristic, not semantic understanding; user selection does not prove correctness. The task-before-background teaching example permits all policies to be compared without asserting one is best.

### Independent features and contribution records

Chunks/decisions explicitly carry `hardProtected` and `hardProtectionReasons`. The old `reasons`/`protected` aliases remain for compatibility, with the same values. No hard detector was weakened. Soft instruction/entity/structure functions read text directly, never protection labels. Thus an eligible question, single internal capitalized name or colon label can receive a signal. Many strong signals still co-occur with hard protection and have no influence on whether those protected chunks survive.

For weights `w`, feature values `f`, and `Z = w_relevance + w_information + w_instruction + w_entity + w_structure`:

```text
positive contribution_i = w_i * f_i / Z  (0 when Z = 0)
redundancy contribution = -w_redundancy * f_redundancy
raw score = sum of all six contributions
originalScore = clip(raw score, 0, 1)
transformedScore = selected transform(originalScore)
```

Every scored decision stores feature values, actual effective weights, each normalized contribution, Z, the unclipped raw score, relevance metric and original focus ID. Model-enabled relevance also records the model ID, resolved revision and dtype independently of the final similarity measurement. Empty focus/whitespace-only chunks explicitly record `missing-empty-text` relevance with a zero contribution convention; they do not claim an embedding measurement. Importance and Similarity guard retain fixed default weights; only Weighted hybrid uses the weight sliders. Similarity guard uses the score to order deletion attempts and separately measures its original-stage embedding floor.

Increasing any positive weight changes Z and rescales all other positive contributions. With no redundancy, that common rescaling alone cannot reorder fixed positive scores, though it can change cutoff admission. A fixed redundancy penalty, clipping and utility-per-token selection can change rankings/admission. Softmax includes protected and whitespace chunks in its normalization as before; protected rows still bypass filtering. No weight is a probability, necessity estimate or learned calibration. The UI rounds numbers for display; exports preserve computed values.

## Protection

Detection returns inspectable reason-tagged spans. Transformation routines may only modify unprotected gaps. Span merging is used for slicing; reason/occurrence records are used for retention metrics. Protection catches common patterns but is not a parser, NER model or proof system. The final runner checks original occurrences after every stage and rejects expansion. Whole JSON protection is deliberately blunt.

Protecting a word string alone does not prove the same sentence relationship or referent survived. Adding an exact entity name manually protects that string, not every statement about it. Numbers and dates may be detected as multiple protected pieces rather than parsed semantic units.

## Embedding path

Resolve an actual Hugging Face commit SHA, load that revision with Transformers.js on WASM/q8, then tokenize each input with the embedding model's tokenizer. At most 254 content tokens are admitted per window; every original code point is traversed. Model-token-weighted pooling is explicitly recorded and has major semantic limitations. Metadata/runtime/model files can be fetched; prompt text stays in the worker.

Semantic guard compares each proposed deletion to a fixed vector for its stage's original input, not only to the preceding accepted candidate. Final experiment similarity compares the pipeline output with the very original prompt. An error stays an error; no lexical fallbacks under the “semantic” label.

## Metrics / export

Standalone metrics define edge cases explicitly. Empty ratios use null. Similarity requires nonzero, equal-dimensional finite vectors. Token counts are for raw selected-encoding text. Timing separates the compression call sequence from the total measured run; warm caches and downloads affect timings. Do not compare these numbers as controlled hardware benchmarks.

The comparison table is filtered by original text and encoding. The Pareto plot includes only measured similarity rows and compatible model revision/dtype. Export scope is explicit: current prompt plus selected encoding (the visible table), or the full in-memory session. Both JSON and CSV honor this selection. Raw text remains excluded by default; JSON text inclusion requires an explicit opt-in. Import/replay of experiment files is a future feature.

JSON schema 2 adds resolved task focus and per-stage decisions, retaining the final-stage decision list for the result view. Redacted JSON removes focus text and decision text at every stage as well as original/compressed text and custom protected strings. CSV includes policy, stable ID, focus SHA-256, reason, fallback, detector version, weights and text-free stage scoring. Hashes/identifiers and feature records can reveal information; hashing is not anonymization. Notebook rows label focus policy/chunk; selecting a row restores that run's text, relevance and protection for comparison. The draft selector never relabels an earlier result. No chart of invented outcomes or task-performance comparison is added.

## Explore, draft controls and recorded results

Explore is the initial view and runs three presets using existing examples and strategies. Research exposes the complete instrument. Switching views preserves controls and history; selecting a guide deliberately replaces the editor and draft controls with a displayed preset, with existing runs retained in memory. View preference is session-only; no persistence or telemetry was added.

Draft controls are distinct from the immutable settings stored on a run. Result metadata, diff protection, metrics and token inspection use the recorded run, including its tokenizer when the draft encoding has changed. A conservative change notice compares all draft settings and the intended method sequence, even settings not applicable to that method. The snapshot labels unused controls as not applied. A chain's budget is per applicable stage, and its displayed budget status describes the final stage.

Analysis snapshots now include custom protected terms as well as text and encoding. A change to any of these invalidates the displayed analysis until analysis or a run refreshes it. Token inspection can reload the original with an older result's recorded encoding without re-running compression. Task correctness is not measured by a compression run; separate optional downstream evaluations remain in Gemini Arena.

Result tabs use associated tab/tabpanel IDs, roving tabindex, automatic activation on Left/Right/Home/End, and visible focus. Hidden Research controls and inactive panels are excluded from keyboard navigation.

## Gemini security boundary

The browser never receives a key. A loopback-only native Node server reads `GEMINI_API_KEY` and `GEMINI_MODEL`, validates local requests, and makes at most two text-generation calls per comparison. It sends the original and compressed prompts separately, with identical generation settings, without injecting the reference answer. It returns visible answer text, provider token usage, provider model version when reported, finish reason and local elapsed time.

There is no tool use, command execution, remote URL supplied by the client, arbitrary API proxying, prompt logging, persistent database or automatic retry. A retry must be a deliberate new user request and might cost more. Local rate limits are not sufficient for a public service. Any future public API use requires separate authentication, authorization, quotas, abuse controls, billing governance and an explicit privacy policy.

## Intentional scope decisions

This source contains the core engine/UI and an optional local Gemini harness. It does not contain a trained compression model, a Python LLMLingua runtime, production cloud infrastructure, NER guarantees, a proof of semantic preservation, a fabricated composite quality score, real benchmark results or a claim of a rendered/verified release. See BUILD-STATUS.
