# Mathematical shaping: what changes, and what survives?

TokenLab makes familiar mathematical functions and a heuristic selector inspectable. These are not new research algorithms, trained attention weights, or a claim of better downstream answers.

Try **Same scores, different math** in the example selector, then **Analyze prompt → Compare math**. Expand **Sigmoid vs Softmax** to inspect the same original chunks. The optional **Compression vs preservation** preset runs four independent budget levels. Research exposes the controls; the default experience needs no model download or API key.

## What is an importance score?

A chunk is an exact slice of the original prompt. Its importance score combines observations about that slice:

- Relevance to the recorded original task focus: bag-of-words cosine, or actual local embedding cosine when enabled for the weighted engine.
- Information: average within-prompt word-frequency surprisal, normalized by `log2(total words)`. A rare word has higher `−log2(p(word))`. This is not neural perplexity or contextual language-model surprisal.
- Surface instruction, entity and structure signals. These are incomplete English heuristics, not semantic parsing.
- Redundancy: maximum word-bigram Jaccard overlap with an earlier chunk.

For positive features `f = relevance, information, instruction, entity, structure` and weights `w`:

```text
W = sum of the five positive weights
raw = sum(w_f * f) / W − w_redundancy * redundancy
x = clip(raw, 0, 1)
```

If `W = 0`, the positive term is zero. The redundancy penalty is outside the normalization. Raising one positive weight rescales all positive contributions. The score is a hand-designed preference, not a calibrated probability that the chunk is needed. Hard protection is separate: a protected chunk remains even at score zero.

The study uses the existing **Weighted hybrid** strategy. It honors the current weights, unlike the individual **Importance + math** button, which uses fixed default weights. Enabling embeddings changes the study's relevance feature as well as measuring final output similarity. Compare transforms within a study; an embedding-enabled study and a lexical study do not have identical raw features.

## What does shaping do?

The engine computes these functions for scores in `[0,1]`:

| Transform | Formula |
| --- | --- |
| Linear | `x` |
| Square | `x²` |
| Square root | `sqrt(x)` |
| Logarithmic | `log(1 + 9x) / log(10)` |
| Exponential | `(exp(4x) − 1) / (exp(4) − 1)` |
| Sigmoid | `1 / (1 + exp(−k(x − t)))` |
| Softmax share for chunk i | `exp(x_i/T) / sum_j exp(x_j/T)` |

For fixed positive parameters these functions preserve the ordering of the raw scores. Softmax shares also preserve that ordering within a fixed set. They do not discover new semantic importance or reorder a fixed ranking on their own. Finite precision can create ties at extreme parameters.

Selection can still change because TokenLab applies a **numeric cutoff** and sorts eligible chunks by **shaped score divided by token cost**. Different costs mean ordering by `f(x)/cost` need not match ordering by `x/cost`. The cutoff is also crossed at different raw scores under different transforms.

The selection path is:

```text
fixed raw features → shaped scores → eligibility and value per token
→ greedy admission within the token budget → retained original slices
```

The engine begins with all protected chunks. Other chunks must pass the shaped-score cutoff, then fit in greedy value-per-token order; ties choose the earlier chunk. The cost denominator is `max(1, isolated chunk BPE tokens)`. Admission uses the exact BPE count of the **whole reconstructed candidate**, because chunk counts are not additive. Output keeps the original chunk order. This is not a globally optimal knapsack solution; a looser target need not be filled, and greedy selections need not form nested sets.

## Sigmoid: each score independently

The center `t` maps to `0.5`. Increasing steepness `k` pushes values below the center toward zero and values above it toward one. Raising the center lowers shaped values at a fixed raw score. Adding another chunk does not directly change this pointwise function's value for an existing score.

The Research curve shows the center and steepness. A cutoff applied after sigmoid is distinct from its center; the center is not itself a hard deletion rule.

## Softmax: relative shares across a set

Softmax allocates one unit of mass across **all original chunks**, including protected and whitespace chunks. Its denominator contains every competitor. A chunk's share can change when another score changes, even if its own raw score does not. A share is not the probability that a chunk is useful.

`T` is temperature. Lower positive `T` concentrates mass on higher scores; higher `T` flattens the shares. Equal scores get equal shares. The engine subtracts the maximum score before exponentiation to avoid overflow:

```text
e_i = exp((x_i − max(x)) / T)
s_i = e_i / sum_j e_j
```

An empty set returns `[]`; a single score gets share `1`. The UI uses a four-score distribution, not an independent Softmax transfer curve.

These numbers were produced by the actual `transformScores` function, rounded here to four decimals:

| Raw | Sigmoid k=10, t=.5 | Softmax T=1 | Softmax T=.25 |
| --- | --- | --- | --- |
| .20 | .0474 | .1807 | .0521 |
| .40 | .2689 | .2207 | .1159 |
| .60 | .7311 | .2695 | .2579 |
| .80 | .9526 | .3292 | .5741 |

Each Softmax column sums to one before display rounding. Sigmoid has no such sum constraint. These are calculated illustrations, not experiment results on a prompt.

For pointwise transforms the effective cutoff is the slider value. For Softmax it is `slider / total chunk count`, expressed relative to a uniform share. This is an explicit selection-policy choice, not a mathematically equivalent threshold across transforms. Even a zero raw score receives positive Softmax mass; whitespace can become eligible. The comparison therefore studies each transform **with this documented cutoff rule**, not isolated ranking quality.

## Actual teaching-example results

Executed on 2026-09-09 using engine `tokenlab-0.3.0`, actual `gpt-tokenizer` 4.0.0 `o200k_base`, Auto task focus on the first instruction, default weights, cutoff `.25`, sigmoid `k=10, t=.5`, Softmax `T=.25`, no custom protection and embeddings disabled. The original contains **138 tokens**, 23 chunks and 11 whitespace-only chunks. All seven runs use a **65% target: floor(138 × .65) = 89 tokens**. Only transform changes.

| Transform | Actual tokens | Saved | Savings | Kept / removed chunks |
| --- | --- | --- | --- | --- |
| Linear | 86 | 52 | 37.7% | 8 / 15 |
| Square | 40 | 98 | 71.0% | 4 / 19 |
| Square root | 82 | 56 | 40.6% | 8 / 15 |
| Logarithmic | 82 | 56 | 40.6% | 8 / 15 |
| Exponential | 40 | 98 | 71.0% | 4 / 19 |
| Sigmoid | 51 | 87 | 63.0% | 5 / 18 |
| Softmax | 88 | 50 | 36.2% | 19 / 4 |

All targets were met and all detected protected occurrences retained. Similarity was **not measured** in this table. Square and Exponential selected identical chunks/text; Square root and Logarithmic also tied. These observations do not identify a winner.

Sigmoid and Softmax agreed to retain five chunks, differed on fourteen and removed four under both. **Eleven of those fourteen differences are whitespace-only chunks; three contain text.** Sigmoid retained five text-bearing chunks, while Softmax retained eight. A chunk count must not be interpreted as a count of useful facts.

For example, “The irrigation pump occasionally stalls during dry weather.” has raw score `.2486`, sigmoid `.0749` and Softmax share `.0369` in this run. Sigmoid excludes it below cutoff `.25`. Softmax's effective cutoff is `.25/23 ≈ .01087`; that chunk passes and fits the budget. This describes the engine decision, not proof that either output can support a correct recommendation.

## Budget is a ceiling, not an achieved percentage

For these independent runs:

```text
target tokens = floor(original full-string BPE tokens * requested retained fraction)
actual retention = compressed full-string BPE tokens / original tokens
savings percent = 100 * (original tokens − compressed tokens) / original tokens
compression factor = original tokens / compressed tokens
```

Undefined ratios are missing, not infinity. In a separate **Linear** ladder with the same lexical settings and original:

| Requested retention | Target tokens | Actual tokens | Actual retention | Budget |
| --- | --- | --- | --- | --- |
| 90% | 124 | 86 | 62.3% | Met |
| 70% | 96 | 86 | 62.3% | Met |
| 50% | 69 | 62 | 44.9% | Met |
| 30% | 41 | 40 | 29.0% | Met |

The cutoff excludes some content even at loose budgets. The 90% and 70% levels select identical chunks. Every level starts from the original; none compresses the preceding level's result. The ladder uses whichever transform is selected when it starts; after Compare math that is Softmax, so select Linear first to reproduce this particular ladder.

Protection can override the target. For the separately tested prompt `Do NOT delete the database.`, every ladder level retains 100% and reports budget unmet. The whole detected instruction is protected. Other detector gaps remain possible; retaining detected exact strings does not preserve every relation or meaning.

## Similarity is a separate diagnostic

The optional model is `Xenova/all-MiniLM-L6-v2`, resolved revision `751bff37182d3f1213fa05d7196b954e230abad9`, q8/WASM, Transformers.js 3.8.1. Full long inputs are windowed with the model tokenizer and pooled; there is no prefix-only replacement metric.

The real-model study on this example measured sigmoid at 51 tokens / cosine `.8495` and Softmax at 88 tokens / cosine `.9489`. Its relevance features are embedding-based, so it is a separate controlled study from the lexical table above. A model-enabled **Softmax** ladder measured 124, 88, 64 and 41 actual tokens for the 90%, 70%, 50% and 30% targets. The corresponding cosines were `.9831`, `.9489`, `.8894` and `.8302`.

Cosine compares vectors. It can miss negation, numbers and logical relationships; long-document pooling can dilute critical details. The displayed compression/similarity frontier concerns only these proxy coordinates. Neither a high cosine nor protected-string retention establishes task correctness. No composite quality score or downstream model evaluation is inferred.

## Controls, records and limits

`engine/studies.ts` snapshots all settings before its first await and calls the normal worker runner independently for each member. It verifies the same original/hash, engine version, encoding, complete resolved focus, weights, protection, raw features/scores and chunk costs before publishing a group. Transform studies vary only `transform`; ladders vary only `budget`. A failed or cancelled study publishes no partial group. The normal final guard still enforces original protected occurrences and nonexpansion; a restored candidate with unavailable decisions cannot support a chunk comparison.

Each notebook run retains its input/output hashes, engine version, timestamp, study identity/index, full settings, focus policy/hash, counts, decisions and measured model metadata. A study adds references/identity rather than another large original snapshot. JSON schema 2 gains optional study metadata; CSV includes study identity too. Default exports redact original/compressed/focus/chunk text and custom protected strings. Text-inclusive exports remain an explicit choice; hashes are not anonymization. Session history is capped at 100 runs, so old groups may become incomplete and are labeled accordingly. Import/replay remains deferred.

Raw calculation and browser/model evidence is [curated here](verification/phase3/evidence.json). It stores the synthetic original once and raw features once per study, with the varied settings and actual decisions for each member. It is not a complete notebook export or a benchmark dataset. Tests also cover different encodings, custom weights/focus/protection, numeric boundaries, independent execution, missing measurements and cancellation. [BUILD-STATUS](BUILD-STATUS.md) lists the commands actually executed and remaining environmental limits.
