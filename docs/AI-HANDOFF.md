# Paste this into Codex in VS Code

```text
You are taking over TokenLab in the folder currently open in VS Code.
The project has already been written. Do not start over or give me another
implementation plan. Read AGENTS.md, START-HERE.md, docs/BUILD-STATUS.md,
docs/ARCHITECTURE.md and docs/PRODUCT-SPEC.md.

Take responsibility for getting this application running on my machine:

1. Inspect the current files and Node environment. Install the dependencies
   and create a real package-lock.json. Do not invent a lockfile.
2. Run npm run verify and npm run check:core. Diagnose and fix every actual
   code, type, dependency or API incompatibility. Keep the scientific
   safeguards and tests; do not weaken them to obtain green results.
3. Install Playwright Chromium and run npm run test:e2e. Start the app,
   inspect the actual desktop and mobile interface, and fix runtime errors.
   Verify exact BPE token counts, all deterministic operations, transform
   controls, protected content, chain stages, visual diffs and exports.
4. Verify browser embeddings using the real local model. Verify Unicode and
   long-input handling. If a model cannot load, show the genuine error and
   investigate it; never substitute fabricated similarity values.
5. Record real verification results in docs/BUILD-STATUS.md. Add screenshots
   only from the running app. Do not claim a command passed unless it did.
6. Keep Gemini optional. Do not read, reveal or commit .env.local. Do not
   make paid API calls. I will configure the key and authorize live tests.
7. Leave the application ready to run with npm run dev. Tell me the exact
   local address and any remaining blocker. Show me the evidence, not just
   a statement that the app is complete.

Make the code changes yourself. Ask me only for an access approval or an
account action you genuinely cannot perform. Do not publish, deploy or
change unrelated files without my authorization. Never stop at scaffolding.
```

If Codex is not installed, use VS Code Extensions and install **Codex**, published by OpenAI. Sign in with the supported account method. Agent availability and permissions depend on your account and environment. You do not need a Gemini key to use the app's deterministic core or to run its mocked gateway tests.
