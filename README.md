<p align="center">
  <img src="icon.svg" alt="Karakeep Logo" width="21%">
</p>

# Karakeep on StartOS

> Everything not listed in this document should behave the same as upstream
> Karakeep. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

Karakeep is a self-hostable bookmark-everything app (links, notes, and
images) with AI-based automatic tagging and full-text search. See the
[upstream repository](https://github.com/karakeep-app/karakeep).

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Three upstream images run as three subcontainers, each its own daemon, sharing
this package's loopback network namespace, so each reaches the others at
`127.0.0.1:<port>` where upstream's `docker-compose.yml` uses service names.

| Subcontainer      | Image                                                          | Purpose                                                          |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `karakeep-sub`    | `ghcr.io/karakeep-app/karakeep`                                | The Next.js app server (web UI, API and background workers)      |
| `chrome-sub`      | `ghcr.io/karakeep-app/karakeep-chrome` (via root `Dockerfile`) | Headless Chrome the crawler drives for page archival/screenshots |
| `meilisearch-sub` | `getmeili/meilisearch`                                         | Full-text and vector search index                                |

`chrome-sub`'s image is built through the root `Dockerfile`, a layer that
upgrades Debian's `ca-certificates` so Chrome's system store no longer holds
the distrusted eMudhra (emSign ECC Root CA - G3) root. The other two images are
unmodified.

`karakeep-sub` (which bundles `s6-overlay`) and `chrome-sub` (whose launcher
backgrounds a `socat` port-forwarder before starting the browser) run their
default entrypoints as PID 1 (`runAsInit`). `meilisearch-sub` runs
`/bin/meilisearch` directly in `/meili_data`, bypassing the image's `tini`
entrypoint. Architectures: x86_64, aarch64.

## Volume and Data Layout

Two volumes. `main` holds everything this package persists and is the only one
backed up; `startos` holds only read-only mounts of an AI service's `public`
volume (`<service>-public`), made while Karakeep is connected to vLLM or
llama.cpp to read the API key (and, for vLLM, the model name) the service
publishes.

| Path (in volume `main`) | Mounted into                       | Contents                                                                        |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `data`                  | `karakeep-sub` at `/data`          | Karakeep's SQLite databases (`db.db`, the job queue `queue.db`) and asset store |
| `meilisearch`           | `meilisearch-sub` at `/meili_data` | Meilisearch's index data                                                        |
| `store.json`            | (package-side only)                | This package's generated secrets and settings (below)                           |

`chrome-sub` persists nothing and mounts no volume.

## File Models

The package owns one file, `store.json`; Karakeep itself takes all of its
configuration from environment variables, so there is no upstream config file
on disk to inspect or edit.

**`store.json`** (JSON, volume `main`) — StartOS-side state, not an upstream
file:

| Key                                | Seeded / written by                   | Becomes                                                                                                       |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `nextAuthSecret`, `meiliMasterKey` | Generated once on install             | `NEXTAUTH_SECRET`; `MEILI_MASTER_KEY` for both Karakeep and Meilisearch                                       |
| `adminPassword`                    | **Set Admin Password**                | Nothing at runtime — the password lives in Karakeep's database; the key records that the admin account exists |
| `domain`                           | **Set Primary URL**                   | `NEXTAUTH_URL`                                                                                                |
| `signupsDisabled`                  | `true` on install; **Toggle Signups** | `DISABLE_SIGNUPS`                                                                                             |
| `performance`                      | **Set Performance** (default `high`)  | `SEARCH_NUM_WORKERS` / `EMBEDDING_NUM_WORKERS`                                                                |
| `ai`                               | **Configure AI**                      | The AI variables listed under Actions                                                                         |

Every key is read when the `karakeep` daemon starts and passed as an
environment variable; a change by an action restarts that daemon. A hand edit
to `store.json` applies on the next restart and survives, since nothing
re-asserts these keys — except `adminPassword`, which changes nothing in
Karakeep when edited.

The package also sets these fixed variables on every start:

- `DATA_DIR=/data`, `MEILI_ADDR`, `BROWSER_WEB_URL` (the sidecars over loopback).
- `DB_WAL_MODE=true` — puts `db.db` and `queue.db` in WAL mode. Upstream
  defaults it off for network filesystems; `main` is a local volume, and in
  rollback-journal mode queuing a whole library at once (Admin Settings
  regenerate jobs) held the web process and workers failed with
  `SQLITE_BUSY`.
- `SEARCH_NUM_WORKERS` / `EMBEDDING_NUM_WORKERS` from **Set Performance**:
  low 5/2, medium 20/5, high 50/10 (upstream default 1/1). Each indexing job
  waits for its Meilisearch batch (up to 50 documents or 500 ms), so one worker
  indexes about one document per batch; more workers fill batches. It only
  matters when many bookmarks are processed at once.

## Dependencies

Three optional dependencies, one per AI service Karakeep can connect to on the
same server. Each is enabled only while **Configure AI** is set to that
service, and then must be running with its `primary` health check passing.

| Service   | Version      | Reached at                                           | API key                                         |
| --------- | ------------ | ---------------------------------------------------- | ----------------------------------------------- |
| Ollama    | `>=0.31.2:2` | Bridge address of host `api-multi`, port 11434       | None                                            |
| vLLM      | `>=0.33.0:1` | Bridge address of host `api-multi`, port 8000, `/v1` | `apiKey` in `vllm:public/credentials.json`      |
| llama.cpp | `>=11960:1`  | Bridge address of host `api-key`, port 8080, `/v1`   | `apiKey` in `llama-cpp:public/credentials.json` |

The address and key are read live, so a port change or key rotation on the
service restarts Karakeep with the new values. While the chosen service is
not installed, StartOS reports the unmet dependency and Karakeep runs with no AI
variables set.

## Network Access and Interfaces

The package exposes one interface; the two sidecars are reached only over
loopback by `karakeep-sub`.

| Interface id | Type | Port | Protocol | Purpose                     |
| ------------ | ---- | ---- | -------- | --------------------------- |
| `ui`         | ui   | 3000 | http     | The Karakeep web UI and API |

`chrome-sub` (port 9222) and `meilisearch-sub` (port 7700) are not exposed
through any interface. Karakeep accepts sign-ins from any of the interface's
addresses (upstream's `AUTH_TRUSTED_ORIGINS` default, `*`), not only the
primary URL.

## Installation and First-Run Flow

The package creates the administrator account itself; Karakeep's sign-up page
is never the way in.

- On install, `NEXTAUTH_SECRET` and `MEILI_MASTER_KEY` are generated and never
  shown, and signups are **disabled**.
- A `critical` **Set Admin Password** task blocks the first start. Running it
  creates the administrator (`admin@karakeep.local`) in Karakeep's database and
  returns the email and a generated password.
- `NEXTAUTH_URL` is the address chosen with **Set Primary URL**, or, until one
  is chosen (or while the chosen one is not among the interface's addresses),
  the preferred address: a public domain if any, else the `.local` address.

## Actions

The OS reports each action's metadata; this section covers what it cannot.

- **Set Admin Password** (`set-admin-password`) — first run, and whenever the
  administrator's password is lost. Runs Karakeep's own database migrations
  in a temporary `karakeep` container, then creates the administrator
  (`admin@karakeep.local`) if Karakeep has no admin account, or otherwise sets
  the password of the **oldest** admin account, whatever its email; it deletes
  that account's sessions, signing it out everywhere. Returns the email and the
  new password; the password is shown only then. Takes a few seconds, works
  whether the service is running or stopped, does not restart it, and is safe
  to repeat — each run replaces the password.
- **Toggle Signups** (`toggle-signups`) — opens or closes Karakeep's sign-up
  page (`DISABLE_SIGNUPS`). Closed by default. Accounts can also be created by
  the administrator in Karakeep's Admin Settings without opening signups.
  Restarts the `karakeep` daemon.
- **Set Primary URL** (`set-primary-url`) — which address Karakeep puts in
  links it builds (`NEXTAUTH_URL`); it also becomes the address **Open UI**
  opens. An `https` URL makes Karakeep's session cookies secure-only, so signing
  in over a plain-`http` address then fails. Restarts the `karakeep` daemon.
- **Set Performance** (`set-performance`) — the worker preset above. Lower it
  if the server is sluggish while indexing a large library. Restarts the
  `karakeep` daemon.
- **Configure AI** (`configure-ai`) — connects Karakeep to an inference
  backend for tagging, summaries and, optionally, semantic search. Restarts the
  `karakeep` daemon; applies to new bookmarks only.
  - _Disabled_ (default) — no AI variables are set.
  - _Ollama / vLLM / llama.cpp (on this server)_ (`local-<id>`) — enables that
    service's dependency (see Dependencies).
    - _Ollama_ sets `OLLAMA_BASE_URL` and takes the same model fields as the
      by-URL choices. They list the models Ollama has (`/api/tags`), and the
      save fails on a model it lacks. When Ollama is not running, any name is
      accepted, except that Semantic Search then fails the save.
    - _vLLM_ and _llama.cpp_ take only Summarize Automatically. They set
      `OPENAI_BASE_URL` and `OPENAI_API_KEY` from the key the service
      publishes, and both `INFERENCE_*_MODEL` to the one model it serves:
      the `model` vLLM publishes, read live, or a fixed name for llama.cpp,
      whose single-model server ignores the name. No semantic search.
  - _Ollama server (by URL)_ — `OLLAMA_BASE_URL`.
  - _OpenAI-compatible server (by URL)_ — `OPENAI_API_KEY` and, if a URL is
    entered, `OPENAI_BASE_URL` (blank means OpenAI). The form requires a key
    even for servers that ignore it.
  - All three set `INFERENCE_TEXT_MODEL`, `INFERENCE_IMAGE_MODEL` and
    `INFERENCE_ENABLE_AUTO_SUMMARIZATION`.
  - _Semantic Search_ enabled sets `EMBEDDING_TEXT_MODEL`,
    `EMBEDDING_DIMENSIONS` and `EMBEDDING_ENABLE_AUTO_INDEXING=true`. On save
    the action embeds one word through the server from a temporary `karakeep`
    container to read the vector length; if the server or model does not
    answer, the save fails and nothing is stored. Disabled sets
    `EMBEDDING_ENABLE_AUTO_INDEXING=false`, since upstream otherwise enables it
    whenever `OPENAI_API_KEY` is set without a base URL. Vectors are stored in
    Meilisearch. Existing bookmarks, and every bookmark after a model change,
    need Karakeep's Admin Settings regenerate jobs.

## Tasks

The package raises one task.

- **Set Admin Password** — `critical`, raised while `store.json` holds no
  `adminPassword`: on every fresh install, and after an update from a build
  that never had the action. It blocks the service from starting and clears
  when the action runs. It returns only if `adminPassword` is removed from
  `store.json`.

## Health Checks

Only the web interface's check is shown; the sidecars' checks gate it.

- `karakeep` (shown as "Web Interface") — `GET /api/health` on port 3000. Not
  ready for a while after a start is normal: the database migrations run
  first.
- `meilisearch` (hidden) — `GET /health` on port 7700, with a 15 s timeout
  because Meilisearch answers slowly while indexing a backlog.
- `chrome` (hidden) — port 9222 listening.

`karakeep` requires both sidecars, so if Meilisearch or Chrome fails, the Web
Interface check never starts; read the service logs for the sidecar's own
error.

## Backups and Restore

The whole `main` volume is copied (`sdk.Backups.ofVolumes('main')`): Karakeep's
SQLite databases, its asset store, the Meilisearch index, and `store.json`. No
dump is taken; the service is stopped during the backup, so the WAL is folded
into `db.db` first. The restored Meilisearch index matches the restored
databases, and the restored `store.json` keeps the administrator password and
settings.

Assets are many small files, so file count rather than size drives backup
time: about 86,000 files (4.6 GB) took roughly four hours for a first backup
to an SMB share. Later backups copy only changes.

## Limitations and Differences

1. Signups are closed by default and the first account is created by the
   package, not by signing up.
2. AI tagging, summaries and semantic search are off until **Configure AI** is
   run. Upstream inference variables other than those listed under Actions
   (`INFERENCE_CONTEXT_LENGTH`, `INFERENCE_NUM_WORKERS`, `OLLAMA_KEEP_ALIVE`,
   …) are not exposed.
3. OAuth/OIDC login (`OAUTH_*`) and SMTP (email verification, password reset
   by email) are not wired up.
4. Bookmarks imported without crawled page content are skipped by tagging
   (logged as "missing content") until they are re-crawled.

---

## Quick Reference for AI Consumers

```yaml
package_id: karakeep
image: ghcr.io/karakeep-app/karakeep
architectures: [x86_64, aarch64]
subcontainers: [karakeep-sub, chrome-sub, meilisearch-sub]
volumes:
  main:
    { data: /data (karakeep-sub), meilisearch: /meili_data (meilisearch-sub) }
  startos: { <service>-public: read-only mount of vllm/llama-cpp public volume }
file_models:
  - store.json
startos_managed_env_vars:
  - DATA_DIR
  - NEXTAUTH_URL
  - NEXTAUTH_SECRET
  - MEILI_ADDR
  - MEILI_MASTER_KEY
  - BROWSER_WEB_URL
  - DISABLE_SIGNUPS
  - DB_WAL_MODE
  - SEARCH_NUM_WORKERS
  - EMBEDDING_NUM_WORKERS
  - OLLAMA_BASE_URL (when configured, or from the Ollama dependency)
  - OPENAI_API_KEY, OPENAI_BASE_URL (when configured, or from the vLLM / llama.cpp dependency)
  - INFERENCE_TEXT_MODEL, INFERENCE_IMAGE_MODEL, INFERENCE_ENABLE_AUTO_SUMMARIZATION (when configured)
  - EMBEDDING_TEXT_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_ENABLE_AUTO_INDEXING (when configured)
dependencies:
  optional: [ollama, vllm, llama-cpp] # enabled by configure-ai, kind running
interfaces:
  ui: { type: ui, port: 3000 }
actions:
  - set-admin-password
  - toggle-signups
  - set-primary-url
  - set-performance
  - configure-ai
tasks:
  - { action: set-admin-password, severity: critical }
health_checks:
  - karakeep
  - meilisearch
  - chrome
```
