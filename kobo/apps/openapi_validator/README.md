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

When enabled, this option generates a CSV file used to build the Python constant `OPEN_API_VALIDATION_WHITELIST`.

This whitelist allows specific tests and endpoints to bypass strict validation failures when necessary.

---

#### Recommended Workflow to generate `OPEN_API_VALIDATION_WHITELIST`

**Step 1 — Reset `OPEN_API_VALIDATION_WHITELIST`**

```python
OPEN_API_VALIDATION_WHITELIST = {}
```

**Step 2 — Run tests without strict mode and logs activated**

Configure `testing.py`:

```python
OPENAPI_VALIDATION = True
OPENAPI_VALIDATION_STRICT = False
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG = True
```

Run the full test suite:

```bash
pytest -vv -n auto
pytest -vv --lf
```

This step ensures that all validation errors are detected, and it generates a CSV log containing validation errors.

**Step 3 — Generate the whitelist constant**

Run the whitelist generator:

```python
from kobo.apps.openapi_validator.scripts.generate_constants import run

run(
    'kobo/apps/openapi_validator/scripts/openapi_errors.csv',
    'kobo/apps/openapi_validator/constants.py'
)
```

This generates the `OPEN_API_VALIDATION_WHITELIST` constant used by the middleware.

Bring back `OPENAPI_VALIDATION_STRICT` and `OPENAPI_VALIDATION_BUILD_WHITELIST_LOG` to original values:

```python
OPENAPI_VALIDATION_STRICT = True
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG = False
```

---

## How Whitelisting Works

Each whitelist entry is scoped by:

- Test path
- Endpoint pattern (resolved using Django URL resolver)
- HTTP method
- Error code

Whitelist entries allow tests to intentionally bypass known validation mismatches while maintaining strict enforcement elsewhere.

---

## Performance Considerations

OpenAPI validation adds schema resolution and JSON validation overhead.

It is recommended to:

- Keep validation enabled in development and testing
- Enable selectively in production only when diagnosing API inconsistencies
