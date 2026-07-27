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
- `invalid-json-payload`
- `request-payload-schema-not-found`
- `request-payload-validation`

##### Response Errors

- `response-schema-not-found`
- `response-validation`

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
(`kobo/apps/openapi_validator/scripts/openapi_errors.csv`), used to apply
`allow_openapi_mismatch` markers in bulk (see below).

---

## How Whitelisting Works

Known, accepted schema mismatches are declared per test with a pytest marker:

```python
@pytest.mark.allow_openapi_mismatch('response-validation', 'api/v2/environment/', 'GET')
def test_something(self):
    ...
```

Marker arguments are `(error_code, route, method)`:

- `error_code` — one of the six codes listed above
- `route` — the Django-resolved route of the request path, without regex
  anchors (e.g. `api/v2/assets/(?P<uid_asset>[^/.]+)/`)
- `method` — the HTTP method, uppercase

Markers are stackable (one per allowed mismatch) and can also be placed on a
test class to cover all its tests. A bare `@pytest.mark.allow_openapi_mismatch`
allows any mismatch in the test — reserve it for unusual cases.

A mismatch without a matching marker raises `AssertionError` in strict mode
and fails the test: fix the schema (preferred) or add a marker consciously.

The marker plumbing lives in the root `conftest.py` (an autouse fixture stores
the running test's markers in `kobo/apps/openapi_validator/context.py`, where
the middleware reads them).

---

#### Bulk-applying markers after a large merge

When a big merge introduces many new mismatches at once:

**Step 1 — Run tests without strict mode and with logging activated**

Configure `testing.py`:

```python
OPENAPI_VALIDATION = True
OPENAPI_VALIDATION_STRICT = False
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG = True
```

Delete any stale `scripts/openapi_errors.csv`, then run the full test suite:

```bash
pytest -q -n auto --dist=loadfile
```

**Step 2 — Apply the markers**

Run the codemod with `./manage.py shell`:

```python
from kobo.apps.openapi_validator.scripts.apply_markers import run

run('kobo/apps/openapi_validator/scripts/openapi_errors.csv')
```

It inserts the missing `allow_openapi_mismatch` decorators into the test
files (idempotent; already-marked tests are skipped) and prints any test it
could not locate. Review the diff — every new marker is a documented schema
mismatch someone should eventually fix.

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
