# Benefits NAS Implementation Plan

**Goal:** Publish the existing benefits app to GitHub and deploy it to the user's NAS using Asset's authenticated application and dedicated MongoDB architecture.

**Architecture:** The same Node app serves the existing UI and an authenticated snapshot API. MongoDB stores normalized schema-version-2 records using atomic revision checks. The browser preserves legacy local backups and failed drafts; cloud defaults are never silently uploaded. GitHub Actions tests and publishes a GHCR image; NAS runs a dedicated Compose project.

**Tech stack:** Vanilla browser JavaScript, Node 22, MongoDB Node driver, MongoDB 7, Docker Compose, GitHub Actions/GHCR.

## Tasks

- [x] Audit Asset's deployment and authentication pattern.
- [x] Audit current local data schema and migration risks.
- [ ] Backend: session login, same-origin protections, static allowlist, GET/POST snapshot API, atomic revisions and exact retry handling.
- [ ] Frontend: authenticated bootstrap, cloud-first reads, await save acknowledgement, freeze dialog-opening revision, preserve local backups and conflicts.
- [ ] Deployment: independent `benefits` app, `mongodb-benefits` database, `/volume1/docker/mongodb/data/benefits` persistence, independent credentials, GHCR image.
- [ ] Verify tests, package lock, source/secret separation and GitHub publication.
- [ ] Inspect live NAS configuration, choose an unused port, deploy Compose and configure `benefits.mcj.life` using the same routing approach as Asset.
- [ ] Import the current local records only after verifying the new cloud database is empty; verify counts and retained field values.
- [ ] Verify login, saving, stale-write rejection, application restart persistence and public-domain access.

## Fixed API contract

`GET /api/session` returns local/cloud mode and authentication state. `POST /api/login` and `POST /api/logout` manage the session cookie. Authenticated `GET /api/benefits` returns `{version:2, initialized, revision, records, updatedAt}`. Authenticated `POST /api/benefits` accepts `{version:2, baseRevision, records, requestId}`; stale revisions return `409 REVISION_CONFLICT`. Payloads are capped at 4 MiB. `/healthz` contains no private data.

## Deployment constraints

Do not change Asset or other NAS applications. Keep database ports internal, data and runtime secrets outside Git and images, and production traffic protected by the application login and HTTPS origin validation. Container/database/directory names use English. Existing local browser data remains recoverable during cloud migration.
