# TAMUSNI local editorial recovery agent

The Cloudflare editorial worker is the permanent scheduler and D1 is the source
of truth. This Windows agent is a deliberately limited recovery worker: it can
only claim the oldest due editorial job, ask the already authenticated local
Codex CLI to prepare one source-backed brief, and submit that result to the
editorial worker for server-side validation and publication.

It has no D1 credentials, no admin session, no payment access and no generic
content-creation endpoint. The worker accepts its requests only with the
separate `LOCAL_AGENT_TOKEN` secret and with the job's short-lived lock token.

## Installation

Run once from a signed-in Windows user after the Cloudflare worker secret has
been configured:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-agent\install-local-agent.ps1 `
  -WorkerOrigin https://YOUR-EDITORIAL-WORKER.workers.dev `
  -Token YOUR_LOCAL_AGENT_TOKEN
```

The installer stores the token encrypted with Windows DPAPI in the current
user's local app-data folder and creates the **TAMUSNI Editorial Local
Recovery** scheduled task. It runs at sign-in and then every 30 minutes. Each
invocation handles at most one job, so delayed work is recovered in order and
does not create a burst of publications.

## Operational rules

- Cloudflare always records every scheduled deadline in D1.
- A free Workers AI quota error leaves a job in `retry_pending` with
  `waiting_reason=AI_QUOTA_EXHAUSTED`; it is never treated as completed.
- The local agent may claim deferred work, but a D1 lease prevents it from
  colliding with the cloud worker. Expired leases become retryable.
- The submission path applies source-host, evidence, originality, multilingual
  and SEO/GEO checks again before a publication can be created.
- No paid OpenAI API key is used or stored by this design. The local agent uses
  the existing interactive Codex login when it is available.
