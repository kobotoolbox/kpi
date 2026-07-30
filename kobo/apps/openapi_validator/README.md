# OpenAPI Validation Middleware

This middleware validates API requests and responses against the OpenAPI schema and helps detect inconsistencies between implementation and documentation.

---

## Overview

The OpenAPI validation system supports:

- Runtime validation of requests and responses
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

This setting can be controlled through an environment variable `OPENAPI_VALIDATION` as a boolean.

It can be useful in production to detect undocumented or untested API behaviours.
However, enabling validation may introduce performance overhead.

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
from kobo.apps.openapi_validator.scripts.generate_constants import run

run(
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

## Performance Considerations

OpenAPI validation adds schema resolution and JSON validation overhead.

It is recommended to:

- Keep validation enabled in development and testing
- Enable selectively in production only when diagnosing API inconsistencies
