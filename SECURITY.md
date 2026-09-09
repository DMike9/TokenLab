# Security and privacy boundaries

The keyless application is intended to process prompts in the user's browser. Public static hosting still receives asset requests, and opted-in local model loading requests public model files. Prompts and vectors are not intentionally persisted or sent by core algorithms. Browser extensions, other software, exports and clipboard contents are outside this guarantee.

The optional Gemini gateway sends authorized prompt pairs to Google. It reads `.env.local` server-side and binds only to loopback. Host/Origin validation, request caps and rate/concurrency limits are development safeguards, not strong authentication or a guaranteed billing cap. Never expose this server publicly, through a tunnel, or by changing the bind address. Processes on the same computer can access local services; this is not an isolation boundary against local malware.

Never put an API key in React source, a `VITE_` variable, screenshots, a pasted terminal transcript, a repository or an export. Do not ask an agent to print environment files. Rotate exposed keys and review provider usage. No telemetry, third-party fonts, analytics or automatic remote prompt submission are added.

Do not open a public issue containing prompts, personal information, credentials or exploitable deployment details. No private reporting address has been configured for this project; the maintainer should enable a private vulnerability-reporting channel before a public launch. Do not invent a reporting address.

For a future public AI backend, require separate authentication, per-user authorization/quotas, provider-side billing controls, secure secret storage, abuse prevention, appropriate logging without prompt leaks, incident handling and a documented data policy. The current local gateway is not that backend.

The hardening review and executed local checks are recorded in [docs/HARDENING-REPORT.md](docs/HARDENING-REPORT.md). Synthetic fault-injection tests and local model tests are separate; no gateway tests use a real key. Clearing the session also resets the text-export opt-in. Public model-download caches may remain, and exported hashes are not anonymization.
