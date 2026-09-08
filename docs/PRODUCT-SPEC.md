You are acting as a senior AI research engineer, ML engineer, full-stack engineer, and technical researcher.

I want you to create an open-source GitHub project from scratch called **TokenLab**.

## 1. What I am trying to build

TokenLab is an interactive research playground for experimenting with prompt compression.

A user should be able to paste ONE prompt into the application and then apply different compression algorithms, mathematical transformations, and token-selection strategies to that SAME prompt.

The application should immediately show:

- Original prompt
- Compressed prompt
- Exact original token count
- Exact compressed token count
- Tokens removed
- Percentage reduction
- Compression ratio
- Characters removed
- Words removed
- Semantic similarity between original and compressed text
- Visual diff showing exactly what disappeared or changed
- Individual token visualization when useful
- Algorithm/operation used
- Parameters used
- Processing time

The point is NOT simply to build another token counter.

The point is to create a visual experimental engine for asking:

**How much of a prompt can we remove before we begin destroying the information the model actually needs?**

I want this to be educational, technically legitimate, visually interesting, and useful as an applied AI research project.

---

# 2. Research before implementation

Before writing the architecture, research the current state of the following:

1. OpenAI tiktoken and current BPE encodings.
2. Current browser-compatible GPT tokenizers.
3. Hugging Face Transformers.js and browser-side inference.
4. Sentence Transformers and semantic textual similarity.
5. Microsoft LLMLingua.
6. LLMLingua-2.
7. LongLLMLingua.
8. Prompt compression research based on:
   - perplexity
   - information content
   - entropy
   - surprisal
   - token importance
   - semantic similarity
   - redundancy elimination
   - sentence/chunk importance
9. Current research on efficient context and prompt compression.

Use primary sources, papers, official repositories, and official documentation wherever possible.

Document these sources in the README.

Do not blindly copy LLMLingua or another existing project.

TokenLab should implement several simple methods from first principles so users can SEE the concepts operating.

Where an existing research implementation is useful, integrate it as an explicitly labeled comparison method.

---

# 3. Scientific constraint

Token IDs are arbitrary vocabulary identifiers.

DO NOT perform arithmetic such as adding, subtracting, multiplying, averaging, or otherwise manipulating token IDs and claim that this represents semantic compression.

The mathematics in TokenLab must instead operate on meaningful quantities such as:

- token/chunk importance scores
- probabilities
- similarity scores
- information content
- entropy
- surprisal
- frequency
- redundancy
- compression budgets
- thresholds
- normalized weights

The application should explicitly teach this distinction.

---

# 4. Technology stack

Build the primary MVP as a local-first web application.

Preferred stack:

- React
- TypeScript
- Vite
- modern CSS or Tailwind
- Vitest
- browser-compatible GPT tokenizer
- Hugging Face Transformers.js where useful
- browser-side embeddings when practical

The basic application MUST NOT require an OpenAI API key.

Prompt text should remain local for all core algorithms.

Use a current browser-compatible tokenizer capable of accurately handling modern OpenAI BPE encodings such as:

- o200k\_base
- cl100k\_base
- r50k\_base

Verify current library support rather than assuming an outdated implementation.

---

# 5. Main UI

Create one large input area:

**ORIGINAL PROMPT**

Under it place:

**Analyze Prompt**

Immediately display:

Original Tokens: 1,247
Words: 823
Characters: 5,931
Tokenizer: o200k\_base

Then create a section called:

# COMPRESSION LAB

Display compression strategies as clickable cards/buttons.

Each operation runs independently against the ORIGINAL prompt unless the user intentionally chooses "Chain Operations."

---

# 6. Compression operations

Implement the following progressively.

## Operation 0 — Baseline

No compression.

Tokenize the original text and visualize the tokenizer boundaries.

Allow the user to click a token and see:

- token text
- token ID
- byte representation if available
- position
- neighboring tokens

This establishes what tokenization actually does.

---

## Operation 1 — Structural Minification

Perform safe mechanical reductions such as:

- repeated whitespace
- redundant line breaks
- unnecessary formatting
- repeated punctuation where safe

Do NOT change meaning intentionally.

Show exactly which characters produced token savings.

---

## Operation 2 — Redundancy Compression

Detect duplicated or highly redundant text.

Examples:

- repeated sentences
- repeated instructions
- repeated phrases
- duplicated n-grams

Allow controls for:

N-gram size
Similarity threshold
Minimum repetition count

Show which repeated information was removed.

---

## Operation 3 — Lexical Compression

Replace unnecessarily verbose expressions with shorter equivalents.

Examples conceptually:

"in order to" → "to"

"due to the fact that" → "because"

Do not rely exclusively on a hard-coded gimmick dictionary.

Start with deterministic rules, but design the engine so better methods can later replace them.

Protected content must not be rewritten.

---

## Operation 4 — Stopword / Function-Word Experiment

Allow removal of selected low-information words as an EXPERIMENTAL mode.

This must have a visible warning:

**High token reduction does not necessarily mean information preservation.**

Allow users to see which words were removed.

Never automatically present this as a superior prompt.

---

# 7. Semantic similarity

Run an embedding model locally in the browser if technically practical.

Generate embeddings for:

Original Prompt

and

Compressed Prompt

Calculate cosine similarity:

similarity = (A · B) / (||A|| ||B||)

Display the result.

Example:

Semantic Similarity: 0.94

Clearly state in the UI and documentation:

**Embedding similarity is a proxy for semantic preservation, not proof that two prompts will cause identical LLM behavior.**

Where useful, also expose experimental:

- cosine similarity
- dot product
- Euclidean distance
- Manhattan distance

Explain the mathematical difference.

---

# 8. Similarity-Guided Compression

This is one of the core experiments.

Break the prompt into sentences or meaningful chunks.

Calculate candidate importance.

Attempt removing one candidate.

Recompute semantic similarity to the original.

If:

similarity >= user threshold

retain the deletion.

Otherwise restore the text.

Let the user choose:

Semantic Floor:

1.00
0.99
0.97
0.95
0.90
0.85

Show the relationship:

Higher preservation threshold = less compression.

Lower preservation threshold = more aggressive compression.

---

# 9. Information / Salience Engine

Build an internal structure where each token, word, sentence, or chunk can receive a normalized importance score:

0.0 ≤ importance ≤ 1.0

Do not pretend the first scoring algorithm represents objective truth.

Clearly label the scoring methodology.

Potential features should include some combination of:

- semantic relevance
- frequency
- repetition
- uniqueness
- position
- presence of instructions
- numbers
- proper nouns
- entities
- negation
- quoted text
- code
- variables
- URLs
- structural importance

Create a clean interface so scoring methods can be replaced later.

---

# 10. Mathematical Importance Shaping

THIS IS AN IMPORTANT PART OF THE PROJECT.

Once an importance score x exists between 0 and 1, let the user experiment with mathematical transformations of that score.

Create buttons for:

### Linear

f(x) = x

### Square

f(x) = x²

This should increase the distinction between high-importance and medium/low-importance content after normalization/budget allocation.

### Square Root

f(x) = √x

This should flatten the importance distribution.

### Logarithmic

Use an appropriate normalized logarithmic function.

### Exponential

Use an appropriately normalized exponential weighting function.

### Sigmoid

f(x) = 1 / (1 + e^(-k(x-t)))

Expose:

k = steepness

t = threshold/center

### Softmax

p\_i = exp(x\_i / T) / Σ exp(x\_j / T)

Expose Temperature T.

Let the user visually see how lower and higher temperatures change concentration of importance.

IMPORTANT:

Explain that monotonic transformations do not magically create different semantic rankings by themselves.

Use transformed scores for thresholding, normalized budget allocation, probabilistic selection, or another mathematically defensible selection process so the experiment has meaning.

---

# 11. Compression Budget

Give the user a target slider.

Target tokens:

100%
90%
80%
70%
60%
50%
40%
30%
20%
10%

Define:

Compression Rate = compressed tokens / original tokens

Compression Factor = original tokens / compressed tokens

Token Savings % = (original - compressed) / original × 100

The engine should select the highest-value information it can retain inside the specified budget according to the selected method.

---

# 12. Protected Information

Add a concept called:

**Protected Content**

By default, strongly protect:

- explicit instructions
- negations such as NOT / DON'T / NEVER
- numbers
- dates
- proper nouns
- named entities
- quoted strings
- URLs
- email addresses
- code blocks
- variable names
- JSON keys
- XML tags
- Markdown structure where structurally meaningful

Allow the user to inspect what the algorithm classified as protected.

This is important because deleting one small word like "not" can preserve embedding similarity while completely reversing the instruction.

---

# 13. Hybrid Compression

Create a method where importance can eventually be represented as:

Importance =
α(Semantic Relevance)

- β(Information Value)
- γ(Instruction Importance)
- δ(Entity Importance)
- ε(Structural Importance)

* λ(Redundancy)

Normalize appropriately.

Expose the weights with sliders.

The point is experimental.

Users should be able to change α, β, γ, δ, ε, and λ and immediately see how the compressed prompt changes.

Do not claim this formula is scientifically optimal.

Label it:

**Experimental Weighted Objective**

---

# 14. Compression Score

Create an experimental composite metric.

For example, investigate a metric based on:

- token reduction
- semantic similarity
- protected-information retention

Do NOT invent a mathematically impressive-looking formula without explaining it.

Research possible formulations first.

If we create our own metric, explicitly label it:

**TokenLab Experimental Score**

Document its exact formula and assumptions.

---

# 15. Visualization

The UI should make the mathematics visible.

For each run, display:

ORIGINAL | COMPRESSED

Highlight:

Green = retained
Red = removed
Yellow = rewritten
Purple or another clear treatment = protected

Also create an importance visualization.

Allow text/chunks to be colored or shaded according to importance score.

Hovering should show:

Original Score
Transformed Score
Decision
Reason

Example:

"extremely"

Importance: 0.18
Square: 0.032
Decision: Removed
Reason: low importance + token budget

---

# 16. Comparison Table

Every experiment should become one row.

Columns:

Method
Parameters
Original Tokens
Compressed Tokens
Tokens Saved
Savings %
Compression Factor
Semantic Similarity
Protected Content Retained
Execution Time

Example:

Baseline | — | 500 | 500 | 0 | 0% | 1.0x | 1.000

Minify | — | 500 | 471 | 29 | 5.8% | 1.06x | 0.998

Similarity .95 | threshold=.95 | 500 | 314 | 186 | 37.2% | 1.59x | .953

Hybrid | α=.4 β=.3... | 500 | 246 | 254 | 50.8% | 2.03x | .918

---

# 17. Pareto view

If practical in the MVP, add a chart:

X-axis = Tokens Retained

Y-axis = Semantic Similarity

Each experiment becomes a point.

The goal is to expose the tradeoff between:

**compression vs information preservation**

Identify experiments that appear to lie on the Pareto frontier.

This could become one of TokenLab's signature visualizations.

---

# 18. Chain Operations

Add an advanced mode where users can intentionally combine operations.

Example:

Minify
→ Redundancy
→ Lexical
→ Similarity Guard
→ Importance Threshold

Show token counts after every stage.

Example:

Original: 1,000
Minify: 956
Deduplicate: 821
Lexical: 743
Similarity Prune: 590

Final: 590

41% reduction

This should visually teach that prompt compression can be a pipeline rather than one magic algorithm.

---

# 19. LLMLingua integration — Phase 2

Research Microsoft LLMLingua and LLMLingua-2.

Because the official implementation uses Python, Transformers, and model inference, do NOT force this into the browser if that creates an unreasonable implementation.

Instead create an OPTIONAL backend architecture:

Python
FastAPI
PyTorch / Transformers
LLMLingua or LLMLingua-2

Expose it through something like:

POST /api/compress/llmlingua

Then let TokenLab compare:

TokenLab algorithms

versus

LLMLingua

on exactly the same prompt.

The basic application must still operate without this backend.

Clearly credit Microsoft and comply with the upstream license.

---

# 20. Experimental downstream evaluation — later phase

Design the architecture so we can eventually send:

Original prompt

and

Compressed prompt

to the same LLM.

Then compare the model's answers.

This will eventually allow us to ask the more meaningful question:

**Did compression change task performance?**

Potential future measures:

- exact match
- rubric evaluation
- LLM-as-judge
- structured-output equivalence
- factual consistency
- task completion
- latency
- cost per correct answer

DO NOT require an external LLM API for the MVP.

---

# 21. Example prompts

Include several built-in test prompts.

Use categories such as:

Simple instruction
Verbose business request
RAG-style context
Long document question
Structured JSON
Code instruction
Multi-step reasoning instruction

Allow:

Load Example

so someone can understand TokenLab without entering their own prompt.

---

# 22. Research mode

Create a collapsible:

**Why did this happen?**

panel.

For each algorithm explain:

What mathematical quantity was measured?

What transformation was performed?

Why did this text survive?

Why was this text removed?

What could go wrong?

This project should teach the user while they experiment.

---

# 23. Architecture

Use a modular engine.

Something conceptually similar to:

src/
components/
engine/
tokenizer/
compression/
scoring/
transforms/
similarity/
protection/
metrics/
models/
hooks/
utils/
tests/

Every compression strategy should implement a common interface.

For example conceptually:

CompressionStrategy

name
description
parameters
compress(input)
metrics
explanation

Do not tightly couple UI code to compression logic.

I want to be able to add new experimental algorithms later.

---

# 24. Reproducibility

For every experiment record:

- algorithm
- version
- tokenizer
- settings
- thresholds
- mathematical transform
- input hash
- timestamp
- results

Allow experiment results to be exported as JSON.

Eventually CSV export would also be useful.

---

# 25. Tests

Write real tests.

Test at minimum:

- token counting
- compression-ratio calculations
- savings percentage
- diff logic
- protected-content behavior
- whitespace compression
- mathematical transforms
- normalization
- similarity calculations
- deterministic strategies
- empty prompts
- Unicode
- code
- JSON
- extremely short prompts
- long prompts

Pay particular attention to negation.

Example:

"Delete the database."

versus:

"Do NOT delete the database."

The protection system must recognize that eliminating "NOT" is catastrophic even if an embedding similarity metric remains high.

---

# 26. README

Create a strong research-oriented README containing:

# TokenLab

Interactive experiments in prompt compression and information preservation.

Then explain:

- research question
- architecture
- screenshots
- setup
- algorithms
- formulas
- tokenizer behavior
- similarity
- known limitations
- scientific caveats
- LLMLingua comparison
- references
- roadmap

Explicitly distinguish:

TOKENIZATION

from

PROMPT COMPRESSION

from

SEMANTIC COMPRESSION.

Explain that lower token count does not automatically mean a better prompt.

---

# 27. GitHub setup

Create the project cleanly from scratch.

Include:

README.md
LICENSE
.gitignore
package.json
TypeScript configuration
tests
logical source structure
clear commit history if possible

Use an appropriate open-source license such as MIT unless dependency requirements dictate otherwise.

Do not commit:

API keys
credentials
large models
build artifacts
node\_modules

---

# 28. UI style

I want it to feel like an AI research instrument, not a generic SaaS dashboard.

Think:

minimal
technical
interactive
slightly playful
dark-mode friendly
beautiful typography
numbers changing live
tokens visually breaking apart
mathematics visible

A technically knowledgeable person should immediately understand that the application is an experiment.

A beginner should still be able to paste a prompt and have fun clicking the different compression methods.

---

# 29. Most important principle

Do not fake intelligence.

If an algorithm is only a heuristic, call it a heuristic.

If an experimental metric has limitations, explain them.

If semantic similarity does not prove behavioral equivalence, say so.

If an operation cannot be performed legitimately without a model, do not pretend otherwise.

I would rather have five scientifically defensible experiments than twenty gimmick buttons.

---

# 30. Work sequence

Do the work in this order:

1. Research.
2. Summarize the relevant existing approaches.
3. Define what TokenLab is adding.
4. Define MVP architecture.
5. Create repository structure.
6. Implement tokenizer and baseline metrics.
7. Implement visual token inspection.
8. Implement deterministic compression.
9. Implement similarity.
10. Implement importance scoring.
11. Implement mathematical transforms.
12. Implement similarity-guided compression.
13. Implement comparison table.
14. Implement visual diff.
15. Add tests.
16. Add README/research documentation.
17. Run application.
18. Fix errors.
19. Run tests.
20. Show me the completed MVP and explain what each part does.

Do not stop after scaffolding.

Do not give me pseudocode instead of implementing working functionality.

Make reasonable engineering decisions without repeatedly asking me questions.

When a design choice is uncertain, choose the simplest scientifically defensible approach, document it, and continue.

The finished MVP should let me paste the same prompt, click different mathematical/compression strategies, and visually discover:

**What disappeared?**

**Why did it disappear?**

**How many tokens did I save?**

**How much semantic similarity did I retain?**

**What mathematical operation caused the difference?**

That is the core of TokenLab.