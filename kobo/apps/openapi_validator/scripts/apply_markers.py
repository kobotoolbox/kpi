"""
Apply `allow_openapi_mismatch` pytest markers to tests from a CSV of
OpenAPI validation errors (produced by the middleware when
OPENAPI_VALIDATION_BUILD_WHITELIST_LOG is enabled).

Run with `./manage.py shell`:

```python
from kobo.apps.openapi_validator.scripts.apply_markers import run

run('kobo/apps/openapi_validator/scripts/openapi_errors.csv')
```

The script is idempotent: markers already present on a test are not
duplicated.
"""

import ast
import csv
from collections import defaultdict

MARKER = 'pytest.mark.allow_openapi_mismatch'
MAX_LINE = 88


def clean(value: str | None) -> str:
    return (value or '').strip()


def read_rows(csv_path: str) -> list[dict[str, str]]:
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        required = {'test_path', 'endpoint', 'method', 'error_code'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f'CSV missing required columns: {sorted(missing)}. '
                f'Found: {reader.fieldnames}'
            )

        rows = []
        for raw in reader:
            row = {key: clean(raw.get(key)) for key in required}
            row['method'] = row['method'].upper()
            # Strip pytest parametrize suffixes from node ids
            row['test_path'] = row['test_path'].split('[')[0]
            if all(row.values()):
                rows.append(row)
        return rows


def group_rules(
    rows: list[dict[str, str]], resolve_endpoints: bool = True
) -> dict[str, list[tuple[str, str, str]]]:
    """
    Group rows into {test_path: [(error_code, route, method), ...]}.
    """
    if resolve_endpoints:
        from ..utils import get_django_route

    rules = defaultdict(set)
    for row in rows:
        route = row['endpoint']
        if resolve_endpoints:
            route = get_django_route(route) or route
        rules[row['test_path']].add((row['error_code'], route, row['method']))

    return {test: sorted(triples) for test, triples in sorted(rules.items())}


def emit_decorator(rule: tuple[str, str, str], indent: str) -> list[str]:
    """
    Render one marker decorator, wrapped to fit MAX_LINE where possible.
    """
    error_code, route, method = rule
    args = f"'{error_code}', '{route}', '{method}'"
    one_line = f'{indent}@{MARKER}({args})'
    if len(one_line) <= MAX_LINE:
        return [one_line]

    lines = [f'{indent}@{MARKER}(']
    for arg in (error_code, route, method):
        arg_line = f"{indent}    '{arg}',"
        if len(arg_line) > MAX_LINE:
            arg_line += '  # noqa: E501'
        lines.append(arg_line)
    lines.append(f'{indent})')
    return lines


def find_target(tree: ast.Module, class_name: str, method_name: str):
    """
    Locate the test function node. Prefer the named class; fall back to any
    class in the file defining the method (the node id's class can be a
    subclass while the method body lives on a base class), then to a
    module-level function.
    """
    fallback = None
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            for child in node.body:
                if (
                    isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and child.name == method_name
                ):
                    if node.name == class_name:
                        return child
                    fallback = fallback or child
        elif (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == method_name
        ):
            fallback = fallback or node
    return fallback


def apply(rules: dict[str, list[tuple[str, str, str]]]) -> list[str]:
    """
    Insert marker decorators into test files. Returns the node ids that could
    not be matched to a function definition.
    """
    per_file = defaultdict(dict)
    for test_path, triples in rules.items():
        parts = test_path.split('::')
        file_path = parts[0]
        class_name = parts[1] if len(parts) == 3 else None
        method_name = parts[-1]
        per_file[file_path][(class_name, method_name, test_path)] = triples

    unresolved = []
    for file_path, targets in per_file.items():
        try:
            with open(file_path, encoding='utf-8') as f:
                source = f.read()
        except FileNotFoundError:
            unresolved.extend(test for (_, _, test) in targets)
            continue

        tree = ast.parse(source)
        lines = source.splitlines()
        insertions = []  # (line_index, decorator_lines)

        # Merge rules for entries resolving to the same function (e.g.
        # subclasses sharing a base test method)
        merged = defaultdict(set)
        for (class_name, method_name, test_path), triples in targets.items():
            func = find_target(tree, class_name, method_name)
            if func is None:
                unresolved.append(test_path)
                continue
            merged[func].update(triples)

        for func, triples in merged.items():
            first_line = min(
                [func.lineno] + [dec.lineno for dec in func.decorator_list]
            )
            indent = ' ' * func.col_offset
            # Compare whitespace-insensitively so both the one-line and the
            # wrapped decorator forms are recognized
            existing = ''.join(
                lines[first_line - 1 : func.lineno]  # noqa: E203
            ).replace(' ', '')
            decorator_lines = []
            for rule in sorted(triples):
                if f"'{rule[0]}','{rule[1]}','{rule[2]}'" in existing:
                    continue  # already marked
                decorator_lines.extend(emit_decorator(rule, indent))
            if decorator_lines:
                insertions.append((first_line - 1, decorator_lines))

        for line_index, decorator_lines in sorted(insertions, reverse=True):
            lines[line_index:line_index] = decorator_lines

        if insertions:
            if not any(
                line == 'import pytest' or line.startswith('import pytest ')
                for line in lines
            ):
                lines.insert(_last_import_line(tree), 'import pytest')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines) + '\n')

    return unresolved


def run(csv_path: str, resolve: bool = True) -> None:
    rows = read_rows(csv_path)
    rules = group_rules(rows, resolve_endpoints=resolve)
    unresolved = apply(rules)
    print(f'Marked {len(rules) - len(unresolved)} tests')
    for test_path in unresolved:
        print(f'UNRESOLVED (add the marker by hand): {test_path}')


def _last_import_line(tree: ast.Module) -> int:
    last = 0
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            last = node.end_lineno
    return last
