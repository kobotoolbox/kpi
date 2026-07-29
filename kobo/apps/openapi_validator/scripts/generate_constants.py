"""
Generate the OPENAPI_KNOWN_MISMATCHES constant from the CSV written by the
middleware when OPENAPI_VALIDATION_BUILD_WHITELIST_LOG is enabled.

Run with `./manage.py shell`

```python
from kobo.apps.openapi_validator.scripts.generate_constants import run

run(
    'kobo/apps/openapi_validator/scripts/openapi_errors.csv',
    'kobo/apps/openapi_validator/constants.py',
)
```

Existing entries are preserved: the CSV only ever adds to the constant, so a
partial test run cannot silently drop known mismatches.
"""

import csv

from ..constants import OPENAPI_KNOWN_MISMATCHES
from ..utils import get_django_route

HEADER = """# Known, accepted mismatches between the API and the OpenAPI schema, as
# (error_code, django_route, method) tuples. Strict validation (tests) lets
# these through; anything else fails the test that triggers it.
#
# Each entry is a documented bug: either the schema lies about the endpoint or
# the endpoint does not honor the schema. Fix the schema and delete the entry.
# See README.md to regenerate this list after a large merge.
OPENAPI_KNOWN_MISMATCHES = frozenset({"""

MAX_LINE = 88


def clean(value: str | None) -> str:
    return (value or '').strip()


def format_entry(triple: tuple[str, str, str]) -> str:
    error_code, route, method = triple
    one_line = f"    ('{error_code}', '{route}', '{method}'),"
    if len(one_line) <= MAX_LINE:
        return one_line

    return (
        f'    (\n'
        f"        '{error_code}',\n"
        f"        '{route}',  # noqa: E501\n"
        f"        '{method}',\n"
        f'    ),'
    )


def read_triples(csv_path: str, resolve: bool = True) -> set[tuple[str, str, str]]:
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        required = {'endpoint', 'method', 'error_code'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f'CSV missing required columns: {sorted(missing)}. '
                f'Found: {reader.fieldnames}'
            )

        triples = set()
        for raw in reader:
            endpoint = clean(raw.get('endpoint'))
            method = clean(raw.get('method')).upper()
            error_code = clean(raw.get('error_code'))
            if not (endpoint and method and error_code):
                # Skip incomplete lines
                continue

            route = get_django_route(endpoint) if resolve else endpoint
            if route:
                triples.add((error_code, route, method))

        return triples


def write_constants(py_path: str, triples: set[tuple[str, str, str]]) -> None:
    with open(py_path, encoding='utf-8') as f:
        existing_content = f.read()

    # Keep everything above the generated constant untouched
    prefix = existing_content[
        : existing_content.index('# Known, accepted mismatches')
    ].rstrip()

    lines = [prefix, '', HEADER]
    lines.extend(format_entry(triple) for triple in sorted(triples))
    lines.append('})')

    with open(py_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def run(csv_path: str, out_path: str, resolve: bool = True) -> None:
    found = read_triples(csv_path, resolve=resolve)
    new = found - set(OPENAPI_KNOWN_MISMATCHES)
    write_constants(out_path, set(OPENAPI_KNOWN_MISMATCHES) | found)

    print(f'{len(new)} new mismatch(es) added, {len(found)} seen in the CSV')
    for triple in sorted(new):
        print(f'  + {triple}')
