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

The constant is only ever appended to: new entries land in a marked block at
the end of the set and everything already in the file (entries, comments) is
left untouched, so a partial test run cannot silently drop known mismatches
and hand-written explanations survive a regeneration.
"""

import ast
import csv

from ..utils import get_django_route


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


def read_existing(py_path: str) -> set[tuple[str, str, str]]:
    """
    Current content of OPENAPI_KNOWN_MISMATCHES, read from the file rather than
    imported, so that repeated runs in one shell see what the previous run wrote.
    """
    with open(py_path, encoding='utf-8') as f:
        tree = ast.parse(f.read())

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == 'OPENAPI_KNOWN_MISMATCHES'
            for target in node.targets
        ):
            return set(ast.literal_eval(node.value.args[0]))

    raise ValueError(f'OPENAPI_KNOWN_MISMATCHES not found in {py_path}')


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


def write_constants(py_path: str, new_triples: set[tuple[str, str, str]]) -> None:
    """
    Append `new_triples` to the OPENAPI_KNOWN_MISMATCHES literal in `py_path`,
    just before its closing brace, under a marker comment. Nothing already in
    the file is rewritten.
    """
    if not new_triples:
        return

    with open(py_path, encoding='utf-8') as f:
        source = f.read()

    # Closing brace of the frozenset literal, the last one in the module
    close = source.rindex('}')
    block = ['        # Added by regenerate_known_mismatches: review, document, ticket']
    block.extend(
        f"        ('{error_code}', '{route}', '{method}'),"
        for error_code, route, method in sorted(new_triples)
    )
    source = (
        source[:close].rstrip() + '\n' + '\n'.join(block) + '\n    ' + source[close:]
    )

    with open(py_path, 'w', encoding='utf-8') as f:
        f.write(format_source(source))


def regenerate_known_mismatches(
    csv_path: str, out_path: str, resolve: bool = True
) -> None:
    found = read_triples(csv_path, resolve=resolve)
    new = found - read_existing(out_path)
    write_constants(out_path, new)

    print(f'{len(new)} new mismatch(es) added, {len(found)} seen in the CSV')
    for triple in sorted(new):
        print(f'  + {triple}')
