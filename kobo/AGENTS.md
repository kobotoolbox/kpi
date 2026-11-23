# Backend

<!-- Maintainers: keep this short. Add a rule when an agent repeats a mistake; leave out what lint or config files already enforce. -->

Read `../CODING_STYLE_BE.md` before writing or restructuring code: it covers formatting, imports, naming, the order of definitions, docstrings, translations and tests.

## Running commands

Python dependencies, PostgreSQL, MongoDB and Redis live in the kobo-install containers. Run `pytest`, `./manage.py` and the scripts below inside the `kpi` container, from the repo root (from `kobo-install`: `./run.py -cf exec kpi <command>`).

## Checking work

- Tests: `pytest <path>`. `pyproject.toml` already sets `DJANGO_SETTINGS_MODULE=kobo.settings.testing`. Add `-n auto` for runs that span many modules.
- Format: `./format-python.sh <base>` before committing, where `<base>` is the branch that the PR targets, such as `origin/main` or `origin/release/2.026.37`. Its Darker step reformats only the lines that differ from `<base>`, but its Ruff step fixes quotes, imports and a few other rules anywhere in the changed files, so review the full diff afterward. Never run `black`, `ruff format` or `isort` on whole files.
- API schema: after a change to a view, a serializer or an `extend_schema` decorator, run `./scripts/generate_api.sh`, and commit `static/openapi/` together with the regenerated `jsapp/js/api/` files. The script also runs Orval through npm; if Orval fails, run `npm ci` first. `--skip-orval` regenerates only the schema.
