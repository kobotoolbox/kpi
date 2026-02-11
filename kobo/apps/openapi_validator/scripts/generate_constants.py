"""
Generate constants.py from a CSV for OpenAPI validation whitelist.

Run with `./manage.py shell`

```python
from kobo.apps.openapi_validator.scripts.generate_constants import run

run(
    'kobo/apps/openapi_validator/scripts/openapi_errors.csv',
    'kobo/apps/openapi_validator/constants.py'
)
```
"""

import csv
from collections import defaultdict

from django.urls import resolve

from ..utils import get_django_route


def clean(value: str | None) -> str:
    return (value or '').strip()


def upper(value: str) -> str:
    return value.strip().upper()


def resolve_to_pattern(endpoint: str) -> str:
    """
    Resolve a concrete URL (e.g. /api/v2/assets/abc/) to its Django route pattern.

    - For path() routes, django.urls.resolve() typically provides `match.route`.
    - For re_path() routes, it may not. We then fall back to regex.pattern if available.
    - If resolution fails, return the raw endpoint as-is.
    """
    try:

        path = endpoint if endpoint.startswith('/') else '/' + endpoint
        match = resolve(path)

        route = getattr(match, 'route', None)
        if route:
            return '/' + route

        regex = getattr(getattr(match, 'pattern', None), 'regex', None)
        if regex is not None:
            return str(regex.pattern)

        return endpoint
    except Exception:
        return endpoint


def read_rows(csv_path: str) -> list[dict[str, str]]:
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        required = {'test_path', 'endpoint', 'method', 'error_code'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"CSV missing required columns: {sorted(missing)}. "
                f"Found: {reader.fieldnames}"
            )

        rows: list[dict[str, str]] = []
        for raw in reader:
            test_path = clean(raw.get('test_path'))
            if not test_path:
                # Skip lines where test_path is empty
                continue

            endpoint = clean(raw.get('endpoint'))
            method = upper(clean(raw.get('method')))
            error_code = clean(raw.get('error_code'))

            if not (endpoint and method and error_code):
                # Skip incomplete lines
                continue

            rows.append(
                {
                    'test_path': test_path,
                    'endpoint': endpoint,
                    'method': method,
                    'error_code': error_code,
                }
            )

        return rows


def build_whitelist(
    rows: list[dict[str, str]],
    resolve_endpoints: bool,
) -> dict[str, dict[str, dict[str, list[str]]]]:
    """
    Output shape:
    {
      test_path: {
        error_code: {
          endpoint: [METHOD, METHOD2, ...]
        }
      }
    }
    """
    methods_map: dict[tuple[str, str, str], set[str]] = defaultdict(set)

    for r in rows:
        endpoint_key = (
            get_django_route(r['endpoint']) if resolve_endpoints else r['endpoint']
        )
        methods_map[(r['test_path'], r['error_code'], endpoint_key)].add(r['method'])

    out: dict[str, dict[str, dict[str, list[str]]]] = {}

    # Convert to nested dicts with deterministic ordering
    for (test_path, error_code, endpoint), methods in methods_map.items():
        out.setdefault(test_path, {}).setdefault(error_code, {})[endpoint] = sorted(
            methods
        )

    out_sorted: dict[str, dict[str, dict[str, list[str]]]] = {}
    for test_path in sorted(out.keys()):
        out_sorted[test_path] = {}
        for error_code in sorted(out[test_path].keys()):
            endpoints = out[test_path][error_code]
            out_sorted[test_path][error_code] = {
                k: endpoints[k] for k in sorted(endpoints.keys())
            }

    return out_sorted


def write_constants(
    py_path: str,
    whitelist: dict[str, dict[str, dict[str, list[str]]]],
) -> None:
    header = (
        "# Auto-generated file. Do not edit by hand.\n"
        "# Generated from CSV -> OPENAPI_VALIDATION_WHITELIST\n\n"
    )

    with open(py_path, 'w', encoding='utf-8') as f:
        f.write(header)
        f.write("OPENAPI_VALIDATION_WHITELIST = ")
        f.write(repr(whitelist))
        f.write("\n")


def run(csv_path: str, out_path: str, resolve: bool = True):
    rows = read_rows(csv_path)
    whitelist = build_whitelist(rows, resolve_endpoints=resolve)
    write_constants(out_path, whitelist)
