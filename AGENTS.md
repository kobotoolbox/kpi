# KPI

KoboToolbox's main web app: a Django backend serving a React frontend. Separate frontend and backend teams own the two halves (see `.github/CODEOWNERS`), and each half can carry its own `AGENTS.md`.

## Map

- `jsapp/`: frontend (React, TypeScript). Read `jsapp/AGENTS.md` before frontend work.
- `kpi/`, `kobo/`, `hub/`: backend (Django). Backend instructions for all three live in `kobo/AGENTS.md`; the files in `kpi/` and `hub/` point to it.
- `static/openapi/`: OpenAPI schemas generated from the backend.

Run npm and npx commands from the repo root, where `package.json` lives.

## API contract

The backend and frontend meet at the OpenAPI schema, and everything along that pipeline is generated:

1. drf-spectacular generates `static/openapi/schema_v2.{yaml,json}` from backend views and serializers (`scripts/generate_api.sh`).
2. Orval generates `jsapp/js/api/react-query/` and `jsapp/js/api/models/` from the schema (`npm run build:orval`).

Change the source and regenerate: the backend view or serializer schema for API shape, `orval.config.js` or the `scripts/orval-*.js` post-processors for generated client code. CI regenerates both steps and fails on any diff against the committed output, so commit the regenerated files together with the change that caused them.

## Pull requests

Title PRs and squash commits `<type>(<scope>)<!>: <title> DEV-1234` (Conventional Commits; `DEV-1234` is the internal issue key). Fill in `.github/PULL_REQUEST_TEMPLATE.md`; its comments define the audience for each section.
