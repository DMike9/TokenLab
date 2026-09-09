# Roadmap: earn the claim before making it

## Gate 0: local verification and post Phase 2 hardening

Local integration and Phase 2 have executed verification. The post Phase 2 [hardening report](HARDENING-REPORT.md) records adversarial regressions, repairs and remaining limits. This remains an experimental development build. The hardening corpus is implementation testing, not the proposed benchmark corpus below. Phase 3 now adds controlled mathematical studies, paired Sigmoid/Softmax decisions and independent budget ladders; see [MATH-EXPERIMENTS](MATH-EXPERIMENTS.md). These make the heuristics inspectable and do not supply downstream validation. The dataset and evaluation gates below remain future work.

## Gate 1: make the evidence stronger

Add a versioned set of 50–100 public or synthetic cases covering negation, numbers, entities, exact structured output, short instructions, RAG distractors, Unicode and long-context retrieval. Provide expected answers and predeclared scoring rules. Keep a holdout set separate from tuning. This is a proposed target, not a dataset already included.

For each case, run the unchanged prompt and compressed variants with the same named model/configuration. Record budgets, tokenizer, model version/revision, finish reasons, usage and failures. Repeat stochastic trials and randomize pair order. Report uncertainty and category-level regressions, not just averages. Use deterministic task checks where possible; mark model-judge judgments as such. Do not select only successful examples.

The public comparison should show token retention versus **task performance**, with embedding cosine as a separate diagnostic. Include failed budgets, broken instructions, API failures and truncated answers. Paid evaluations require explicit authorization and a spending plan; they must not run in ordinary CI.

## Gate 2: optional research-model adapters

Keep Python outside the browser package. Proposed adapter:

```text
POST /api/compress/llmlingua
request: original text, method/model ID, target budget, query, protected terms
response: compressed text, actual model revision, upstream version, runtime,
          measured elapsed time, warnings and supported/unsupported protections
```

Use FastAPI and the upstream LLMLingua/LLMLingua-2 implementation in a separate optional environment. Check model and code licenses, memory/runtime needs and upstream parameter semantics. Re-tokenize the returned text with TokenLab's selected tokenizer. Do not claim that passing a “protected terms” list to a model proves hard constraints; verify outputs. Publish observed results, not the upstream repository's best headline as TokenLab performance.

## Gate 3: richer instrument

Original-prompt task-focus selection and independent soft-score contribution inspection are implemented in Phase 2; their heuristic assumptions still need downstream evaluation. Remaining: raw vocabulary-byte inspection; improved names/entities/schema-aware protection; reproducible import/replay; immutable dependency/model fixture capture; per-token autoregressive surprisal with real model provenance; calibrated thresholds; explicit budget allocation alternatives; model-size/download indicators; keyboard/multilingual accessibility review.

## Deliberate non-goals for the first release

No login, subscription, organization workspace, vector database, cloud orchestration, trained foundation model, arbitrary token-ID algebra, unvalidated all-in-one quality score, automatic paid benchmarks or public unauthenticated Gemini proxy. A credible instrument is more valuable than a large menu of unverified claims.
