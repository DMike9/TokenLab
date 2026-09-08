# Research notes and primary sources

Reviewed September 8, 2026. Library/model availability can change; actual installation and the committed lockfile remain necessary. The choices below are engineering decisions for an educational, local-first lab, not a systematic claim to have evaluated every current method.

## Tokenization and browser inference

1. **OpenAI tiktoken**, official implementation: https://github.com/openai/tiktoken
   BPE encodings convert text to vocabulary IDs. This provides the conceptual baseline and an independent fixture-generation reference, not a neural compression method.
2. **gpt-tokenizer**, upstream TypeScript implementation: https://github.com/niieani/gpt-tokenizer
   Its documented browser and encoding support covers o200k_base, cl100k_base and r50k_base. Version 4.0.0 is pinned here. Raw text counting is separate from chat serialization and model billing. Literal special-token-looking text is encoded with special-token disallowance disabled.
3. **Transformers.js**, official documentation: https://huggingface.co/docs/transformers.js/en/index and https://huggingface.co/docs/transformers.js/en/pipelines
   Browser feature extraction through ONNX enables local vectors without sending prompts to a generation API. The project pins 3.8.1 for the reviewed v3 API rather than chasing an unverified major upgrade. WASM is the compatibility-first path; WebGPU is deferred.
4. **Sentence Transformers semantic similarity**: https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html
   Embedding vectors can be compared with cosine and distance metrics. These are geometric measurements, not guarantees about following instructions or preserving task performance.
5. **all-MiniLM-L6-v2 model card**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
   A 384-dimensional sentence/paragraph encoder with a short input window. The model card's truncation behavior is why TokenLab uses explicit model-token-aware chunking rather than scoring a long prompt's prefix.
6. **ONNX/browser model variant**: https://huggingface.co/Xenova/all-MiniLM-L6-v2
   Loaded on demand. Record the resolved SHA, dtype, pooling/windowing and browser/runtime for reproducibility. The model artifacts have their own upstream terms (the model card identifies Apache-2.0); TokenLab's MIT license does not relicense them.

## Prompt-compression approaches

7. **LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models**, Jiang et al., EMNLP 2023: https://aclanthology.org/2023.emnlp-main.825/
   Uses language-model information/perplexity signals and budgeted prompt reduction. TokenLab's empirical word-frequency scoring is not the same as that contextual neural estimate.
8. **LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression**, Jiang et al., ACL 2024: https://aclanthology.org/2024.acl-long.91/
   Query-aware approaches target which context matters to the task, not only what resembles the whole original. This motivates an explicit task anchor and future downstream evaluation.
9. **LLMLingua-2: Data Distillation for Efficient and Faithful Task-Agnostic Prompt Compression**, Pan et al., Findings of ACL 2024: https://aclanthology.org/2024.findings-acl.57/
   Formulates compression as learned token classification using distilled supervision. It is a meaningful future comparison method, not implemented by giving heuristic deletion buttons the same name.
10. **Official Microsoft LLMLingua repository**: https://github.com/microsoft/LLMLingua
    The upstream implementation uses a model/Python ecosystem and is MIT-licensed. Any future adapter must also check the license/terms of the selected model weights. No upstream model files are included here.
11. **Efficient Prompting Methods for Large Language Models: A Survey**, arXiv:2404.01077: https://arxiv.org/abs/2404.01077
    Broader context for discrete prompt reduction versus other efficient prompting approaches. Treat TokenLab as a visible-text experimental harness, not a soft-prompt or KV-cache compression implementation.

### What TokenLab adds

The proposed contribution is a consistent experimental interface: hold the prompt/encoding constant, expose score shaping and constraints, inspect deletion decisions, record reproducible metadata, and compare savings with local similarity and (optionally) reference-checked downstream answers. The implementation does not claim a new learning algorithm or measured superiority over those papers. Entropy, surprisal, salience, redundancy and semantic relevance must be labeled according to the actual estimator used.

A composite “TokenLab score” is deliberately deferred. A scalar made by multiplying savings and cosine would encode arbitrary preferences, could hide catastrophic instruction failures, and would not validate correctness. Show the measured dimensions separately until a task-grounded utility is specified and tested.

## Gemini, development and publishing

12. **Google key security and migration**: https://ai.google.dev/gemini-api/docs/api-key
    Read secrets server-side; never publish them in browser bundles or source control. The page updated September 2, 2026 states that standard keys need migration to auth keys in September 2026. Check an existing key's current type and access when enabling the optional gateway.
13. **Google token counts and usage**: https://ai.google.dev/gemini-api/docs/tokens
    The selected GPT encoding is not a Gemini tokenizer. The Arena reports Gemini's returned usage metadata and labels missing fields; it does not estimate provider usage from our BPE count.
14. **Google text generation / REST endpoint**: https://ai.google.dev/gemini-api/docs/text-generation and https://ai.google.dev/api/generate-content
    The gateway uses the supported generateContent REST API, a fixed Google API origin and native Node fetch. Newer Interactions APIs are not required for the paired text-generation experiment. The configured model example is gemini-3.8-flash; account availability was not tested. Both prompts use temperature 1 and a 1,024-output-token cap. Those settings do not guarantee repeatability.
15. **Vite setup and deployment**: https://vite.dev/guide/ and https://vite.dev/guide/static-deploy.html
    React/Vite static deployment avoids a paid backend for the keyless lab. Node 22.12+ is used for the selected toolchain; the project deliberately pins a compatible Vite 7.3 release family rather than asserting it is the newest major.
16. **VS Code GitHub workflow**: https://code.visualstudio.com/docs/sourcecontrol/github
    Source Control can initialize, commit and publish a local repository. The user's personal account and visibility should be checked before publication.
17. **GitHub Pages custom workflows**: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
    Pages deploys a static artifact through Actions; it does not start a Node server. The included deployment is manually triggered.
18. **OpenAI Codex IDE extension**: https://developers.openai.com/codex/ide/
    The local coding-agent handoff is meant to close the integration-verification gap in the user's VS Code workspace. It is not a claim that authoring ChatGPT has already operated the user's machine.

## Attribution and claims

TokenLab is independent and is not endorsed by upstream organizations or a university. Our original source is MIT-licensed; dependency and model notices remain applicable. No benchmark numbers, compression-quality improvements, cost savings, paper reproductions or screenshots are presented as measured unless they have actually been collected. The package-backed/runtime checks in BUILD-STATUS remain required.
