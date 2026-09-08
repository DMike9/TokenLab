# Before making TokenLab public

- [ ] Real dependency install and lockfile committed. Review npm audit and dependency/model licenses.
- [ ] Strict typecheck, Vitest, gateway tests, production build and Playwright pass.
- [ ] Real tokenizer parity fixtures independently checked, including Unicode and literal special-token-looking input.
- [ ] Actual browser screenshots inspected at desktop and mobile sizes. No runtime errors or horizontal overflow.
- [ ] Real local embeddings verified, including full long-input coverage, missing-score errors and recorded model SHA.
- [ ] Check browser requests: no prompt telemetry or external inference in core mode; only public model/runtime downloads after consent.
- [ ] Protected-content failures and impossible budgets displayed honestly. JSON/code/negation examples checked.
- [ ] Export inspected for sensitive text and CSV formula handling. Explain that hashes are not anonymity.
- [ ] No .env.local, key, credential, model weights, node_modules, build artifact or company-confidential input in Git history.
- [ ] The repository belongs to the intended personal account. Review visibility before publishing.
- [ ] GitHub Actions succeeds and the actual Pages site is opened and tested at its repository subpath.
- [ ] Gemini remains local-only. Live calls happen only with explicit consent and authorized inputs. Gateway limitations and possible charges are clear.
- [ ] BUILD-STATUS reflects executed commands, not planned work. Research citations and unresolved limitations remain visible.

After these pass, label a first experimental release. Do not imply university sponsorship, scientific novelty, state-of-the-art compression or task-quality improvements without evidence supporting that exact claim.
