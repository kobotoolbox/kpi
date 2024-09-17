#!/bin/bash

BASE_REVISION=$1

if [ -n "${UWSGI_USER}" ] && [ "${DEBIAN_FRONTEND}" == "noninteractive" ] && [ "${TMP_DIR}" == "/srv/tmp" ]; then
    INSIDE_CONTAINER=1
else
    INSIDE_CONTAINER=0
fi

if [ -z "$BASE_REVISION" ]; then
    BASE_REVISION="origin/beta"
elif [ "$BASE_REVISION" == "-l" ] || [ "$BASE_REVISION" == "--last" ]; then
    if [ "$INSIDE_CONTAINER" == "1" ]; then
        BASE_REVISION=$(gosu "$UWSGI_USER" git log --oneline| head -n 1 | awk '{ print $1}')
    else
        BASE_REVISION=$(git log --oneline| head -n 1 | awk '{ print $1}')
    fi
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
if [ "$INSIDE_CONTAINER" == "1" ]; then
    PYTHON_CHANGES=$(gosu "$UWSGI_USER" git diff --name-only "$BASE_REVISION" | grep '\.py')
else
    PYTHON_CHANGES=$(git diff --name-only "$BASE_REVISION" | grep '\.py')
fi

if [ -n "$PYTHON_CHANGES" ]; then
    echo "Using ruff..."
    if [ "$INSIDE_CONTAINER" == "1" ]; then
        gosu "$UWSGI_USER" git diff --name-only "$BASE_REVISION" | grep '\.py' | xargs ruff check --select Q --select I --select F401 --select UP026 --select UP034 --select UP039 --select W292 --fix
    else
        git diff --name-only "$BASE_REVISION" | grep '\.py' | xargs ruff check --select Q --select I --select F401 --select UP026 --select UP034 --select UP039 --select W292 --fix
    fi

    # Applying Black format with `darker` with options:
    # --isort: Using isort
    # --revision: Compare changes with revision $BASE_REVISION
    echo "Using darker..."
    if [ "$INSIDE_CONTAINER" == "1" ]; then
        gosu "$UWSGI_USER" darker --isort --revision "$BASE_REVISION"
    else
        darker --isort --revision "$BASE_REVISION"
    fi
else
    echo "No Python changes detected!"
fi
