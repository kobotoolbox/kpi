# Coding Style Guidelines for Backend




## Automatic Linting Rules

CI runs [Darker](https://github.com/akaihola/darker) on the Python lines that a pull request changes (`.github/workflows/darker.yml`). Darker checks [Black](https://black.readthedocs.io/) formatting and isort import order, then runs flake8 on those lines. Settings live in `pyproject.toml`: line length 88, and Black's `skip-string-normalization`, so single quotes stay single.

Run `./format-python.sh <base>` before committing. The script compares the working tree with `<base>`, which should be the branch that the PR targets:

```sh
./format-python.sh origin/main               # PR against main
./format-python.sh origin/release/2.026.37   # PR against a release branch
./format-python.sh release/2.026.37          # same, against the local branch, which may be stale
./format-python.sh -l                        # only the changes not committed yet
```

It runs two steps on the changed files:

1. `ruff check --fix` on each changed file as a whole, with a few rules: quote style, import sorting, unused imports, deprecated `mock`, extraneous parentheses and the missing newline at the end of a file. It can change lines that you did not touch, so review the full diff afterward.
2. `darker`, which applies Black and isort to the changed lines only, then runs flake8 the way CI does.

Ruff only fixes; it does not format. Formatting follows Black through Darker, not `ruff format`. Do not run `black`, `ruff format` or `isort` on whole files: they reformat lines that the change did not touch and bloat the diff.

The script finds files through `git diff`, so `git add` new files first, or it skips them.




## Manual Linting Rules

Python code should adhere to [PEP 8](https://www.python.org/dev/peps/pep-0008). Indent 4 spaces, and please do **not** use tabs.

### Files

- Do not add `# -*- coding: utf-8 -*-`: Python 3 reads source files as UTF-8. Remove the line from every file that you create or modify.

### Imports

Write imports in three blocks separated by a blank line: standard library, third-party (Django included), then KoboToolbox (`hub`, `kobo`, `kpi`). Sort each block alphabetically, with `import x` lines before `from x import y` lines.

```python
import json
from datetime import timedelta

from django.db import transaction
from rest_framework import status

from kobo.apps.organizations.models import Organization
from kpi.models import Asset
```

### Blank lines and naming

- Two blank lines around top-level functions and classes, one blank line between methods.
- `snake_case` for modules, functions, methods and variables, `CamelCase` for classes, `UPPER_SNAKE_CASE` for constants. The exceptions are names that a framework or an API contract imposes, such as `setUp`.

### Order of definitions

Python has no real public, protected or private members; a leading `_` marks a name as internal. In a module, define public functions and classes first, then the ones prefixed with `_`, each group alphabetically. In a class, order the members like this:

1. Class attributes, fields and nested classes such as `Meta`.
2. Dunder methods, `__init__` first.
3. Public methods, alphabetically.
4. Methods prefixed with `_`, alphabetically.

```python
class ExampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Example
        fields = ('name', 'uid')

    def __init__(self, *args, **kwargs):
        ...

    def create(self, validated_data):
        ...

    def validate_name(self, name):
        ...

    def _get_owner(self):
        ...
```

Some code cannot follow this order. Python needs some names defined before their use at import time, such as a base class before its subclasses, or a function that a decorator calls. Legacy code may not follow any order at all. In those cases, place the new code at the best spot available, and do not reorder the existing code in the same pull request: open a separate formatting pull request for that file, so the move does not hide the real change in the diff.

### Docstrings

- Put the opening `"""` and the closing `"""` each on its own line, even when the text fits on one line.
- Leave one blank line between the closing `"""` and the first line of code.

```python
def get_owner(asset):
    """
    Return the user who owns `asset`.
    """

    return asset.owner
```

### Translations

- Import Django's translation function as `t`: `from django.utils.translation import gettext as t`.
- When the file needs lazy translation, for strings evaluated at import time such as model fields, class attributes or module constants, import `gettext_lazy as t` instead and use it for the whole file. Never import both in the same file.

### Tests

- Use plain `assert` instead of the unittest assertion methods: `assert response.status_code == status.HTTP_200_OK`, not `self.assertEqual(response.status_code, status.HTTP_200_OK)`.
- To check a number of queries, use `with self.assertNumQueries(n)`, with the exact count when the code always runs the same queries. Use `FuzzyInt(low, high)` from `kpi.utils.fuzzy_int` only when the count really varies between runs or settings. Do not use `CaptureQueriesContext`.
