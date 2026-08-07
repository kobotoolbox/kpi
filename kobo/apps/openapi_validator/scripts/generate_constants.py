"""
Generate the OPENAPI_KNOWN_MISMATCHES constant from the CSV written by the
middleware when OPENAPI_VALIDATION_BUILD_WHITELIST_LOG is enabled.

Run with `./manage.py shell`

```python
from kobo.apps.openapi_validator.scripts.generate_constants import (
    regenerate_known_mismatches,
)

regenerate_known_mismatches(
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


def clean(value: str | None) -> str:
    return (value or '').strip()


def format_source(source: str) -> str:
    """
    Normalize the generated module with black, so that the output matches what
    `darker --check` expects in CI. Long routes need no `# noqa: E501`: the
    file disables E501 as a whole.

    Falls back to the unformatted source when black is missing; it is a
    dev-only dependency and this script only ever runs in development.
    """
    try:
        import black
    except ImportError:
        return source

    return black.format_str(
        source, mode=black.Mode(line_length=88, string_normalization=False)
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
    lines.extend(
        f"    ('{error_code}', '{route}', '{method}'),"
        for error_code, route, method in sorted(triples)
    )
    lines.append('})')

    with open(py_path, 'w', encoding='utf-8') as f:
        f.write(format_source('\n'.join(lines) + '\n'))


def regenerate_known_mismatches(
    csv_path: str, out_path: str, resolve: bool = True
) -> None:
    found = read_triples(csv_path, resolve=resolve)
    new = found - set(OPENAPI_KNOWN_MISMATCHES)
    write_constants(out_path, set(OPENAPI_KNOWN_MISMATCHES) | found)

    print(f'{len(new)} new mismatch(es) added, {len(found)} seen in the CSV')
    for triple in sorted(new):
        print(f'  + {triple}')
