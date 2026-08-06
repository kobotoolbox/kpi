# OpenAPI Validation Middleware

This middleware validates API requests and responses against the OpenAPI schema and helps detect inconsistencies between implementation and documentation.

---

## Overview

The OpenAPI validation system supports:

- Validation of requests and responses, under the test settings only
- Strict test enforcement
- Automated whitelist generation for known acceptable deviations

---

## Environment Settings

### `OPENAPI_VALIDATION`

Enables OpenAPI validation and (only) logs detected validation errors to the Python console.

#### Supported Error Codes

##### Request Errors

- `missing-required-parameter`
- `missing-required-payload`
- `invalid-json-payload`
- `request-payload-schema-not-found`
- `request-payload-validation`

##### Response Errors

- `invalid-json-response`
- `response-schema-not-found`
- `response-validation`

#### Not validated

Deliberate gaps, not oversights. Each one is a candidate for a follow-up
ticket; do not treat their absence as "checked and fine":

- **Undocumented operations.** A path or method missing from the schema has no
  contract to compare against, so it is skipped entirely. Reporting endpoints
  absent from the schema is a different feature.
- **Undocumented status codes.** Only the returned status code is looked up; if
  the schema documents none for it, the response is skipped.
- **Non-JSON responses.** File downloads, XML and HTML share the same endpoints
  and cannot be schema-validated.
- **Undocumented request media types.** DRF's default parsers accept
  `multipart/form-data` on every endpoint while drf-spectacular documents only
  `application/json`, so flagging undocumented media types reports one systemic
  fact ~1200 times (297 failing tests when tried) with nothing actionable
  behind it. Schema completeness for media types is a separate concern.
- **Request headers.** Not inspected at all.
- **Query parameter types.** Only the presence of required parameters is
  checked, never types, formats or enums.

#### Notes

⚠️ Test settings only. The middleware raises `MiddlewareNotUsed` unless
`settings.TESTING` is true, so it cannot load on a deployed environment even if
`OPENAPI_VALIDATION` is set — Django then drops it from the stack entirely and
it costs nothing.

Running it against live traffic would mean a schema validation on every
documented JSON request and response, would turn any bug in the middleware into
a 500, and would report the known mismatches below on every hit. Enabling it on
a deployed environment needs its own design (which environments, sampling, how
to keep known mismatches out of the alerting) and is deliberately left to a
follow-up ticket.

---

### `OPENAPI_VALIDATION_STRICT`

⚠️ Intended for test environments only.

When enabled, the middleware will immediately stop request processing and raise an `AssertionError` if any of the six validation error scenarios occur.

This is useful for detecting:

- undocumented API changes
- schema mismatches
- missing validation coverage in tests

---

### `OPENAPI_VALIDATION_BUILD_WHITELIST_LOG`

When enabled, this option appends every validation error to a CSV file
(`scripts/openapi_errors.csv`), used to regenerate `OPENAPI_KNOWN_MISMATCHES`.

---

## How Whitelisting Works

Known, accepted mismatches live in a single constant,
`OPENAPI_KNOWN_MISMATCHES` in `constants.py`, as tuples of:

- Error code (one of the six above)
- Endpoint pattern (resolved by the Django URL resolver, anchors stripped)
- HTTP method

```python
OPENAPI_KNOWN_MISMATCHES = frozenset({
    ('response-validation', 'api/v2/environment/', 'GET'),
    ...
})
```

Each entry is a documented bug — the schema lies about the endpoint, or the
endpoint doesn't honor the schema — not a per-test exception. Any test hitting
a listed endpoint passes; every *other* mismatch fails the test that triggers
it. Fix the schema, delete the entry.

The list is deliberately endpoint-scoped rather than test-scoped: the same
handful of schema bugs is otherwise repeated across hundreds of tests, and
test-scoped entries break whenever a test is renamed or moved.

---

#### Regenerating `OPENAPI_KNOWN_MISMATCHES` after a large merge

**Step 1 — Run the tests without strict mode and with logging activated**

Configure `testing.py`:

```python
OPENAPI_VALIDATION = True
OPENAPI_VALIDATION_STRICT = False
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG = True
```

Delete any stale `scripts/openapi_errors.csv`, then run the full test suite
(lower `-n` on emulated environments such as Apple Silicon):

```bash
pytest -q -n auto --dist=loadfile
pytest -q --lf
```

Always re-run the failures serially with `--lf`: parallel runs produce false
positives, because concurrent HTTP requests interfere with each other. Only
the mismatches that survive the serial re-run are real.

**Step 2 — Regenerate the constant**

```python
from kobo.apps.openapi_validator.scripts.generate_constants import (
    regenerate_known_mismatches,
)

regenerate_known_mismatches(
    'kobo/apps/openapi_validator/scripts/openapi_errors.csv',
    'kobo/apps/openapi_validator/constants.py',
)
```

It prints the entries it adds. Existing entries are kept, so a partial run
can never silently drop a known mismatch. Review the diff: every new line is a
schema bug worth a ticket.

**Step 3 — Restore `testing.py`**

```python
OPENAPI_VALIDATION_STRICT = True
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG = False
```

---

#### Which tests produced an entry?

`OPENAPI_KNOWN_MISMATCHES` is keyed by endpoint, so it does not record where an
entry came from. The CSV does: its `test` column holds the pytest node id of the
test that was running, so the same run that regenerates the constant also
explains it.

```bash
python - <<'EOF'
import csv
from collections import defaultdict

by_entry = defaultdict(set)
with open('kobo/apps/openapi_validator/scripts/openapi_errors.csv') as f:
    for row in csv.DictReader(f):
        key = (row['error_code'], row['endpoint'], row['method'])
        by_entry[key].add(row['test'].split(' (')[0])

for key, tests in sorted(by_entry.items()):
    print(*key)
    for test in sorted(tests):
        print('   ', test)
EOF
```

Useful when a local run produces entries CI does not: the tests behind them
usually point at the difference (an app disabled in your settings, missing
fixtures, a stale schema artifact). Regenerate the schema with
`./scripts/generate_api.sh` before assuming a mismatch is real — validation is
only as correct as `static/openapi/schema_v2.json`.

---

## Performance Considerations

OpenAPI validation adds schema resolution and JSON validation overhead, which
is why it is confined to the test settings. Deployed environments never load
the middleware, so they pay nothing.
