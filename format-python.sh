#!/bin/bash

BASE_REVISION=$1

if [ -z "$BASE_REVISION" ]; then
    BASE_REVISION="beta"
elif [ "$BASE_REVISION" == "-l" ] || [ "$BASE_REVISION" == "--last" ]; then
    BASE_REVISION=$(git log --oneline| head -n 1 | awk '{ print $1}')
fi

# First, do not touch formatting but fix:
#  - single/double quotes (--select Q)
#  - sort imports (--select I)
#  - unused imports (--select F401)
#  - deprecated `mock` (--select UP026)
#  - extraneous-parentheses (--select UP034)
#  - Unnecessary parentheses after class definition (--select UP039)
#  - Indentation warning (--select W1)
#  - No newline at end of file (--select W292)
PYTHON_CHANGES=$(git diff --name-only "$BASE_REVISION" | grep '\.py')
if [ -n "$PYTHON_CHANGES" ]; then
    echo "Using ruff..."
    git diff --name-only "$BASE_REVISION" | grep '\.py' | xargs ruff check --select Q --select I --select F401 --select UP026 --select UP034 --select UP039 --select W292 --fix

    # Applying Black format on changes (since $BASE_REVISION)
    echo "Using darker..."
    darker -i -r "$BASE_REVISION"
else
    echo "No Python changes detected!"
fi
