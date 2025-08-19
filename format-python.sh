#!/bin/bash

BASE_REVISION=$1

WHOAMI=$(whoami)
OWNER=$(ls -ld . | awk '{print $3}')
GOSU_USER=""

if [ "$WHOAMI" != "$OWNER" ]; then
    GOSU_USER=$OWNER
fi

if [ -z "$BASE_REVISION" ]; then
    echo "You must provide the base branch, e.g.: format-python.sh origin/beta"
    exit
elif [ "$BASE_REVISION" == "-l" ] || [ "$BASE_REVISION" == "--last" ]; then
    if [ -n "$GOSU_USER" ]; then
        BASE_REVISION=$(gosu "$GOSU_USER" git log --oneline| head -n 1 | awk '{ print $1}')
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
if [ -n "$GOSU_USER" ]; then
    PYTHON_CHANGES=$(gosu "$GOSU_USER" git diff --name-only "$BASE_REVISION" | grep '\.py')
else
    PYTHON_CHANGES=$(git diff --name-only "$BASE_REVISION" | grep '\.py')
fi

if [ -n "$PYTHON_CHANGES" ]; then
    echo "Using ruff..."
    if [ -n "$GOSU_USER" ]; then
        gosu "$GOSU_USER" git diff --name-only "$BASE_REVISION" | grep '\.py' | xargs ruff check --select Q --select I --select F401 --select UP026 --select UP034 --select UP039 --select W292 --fix
    else
        git diff --name-only "$BASE_REVISION" | grep '\.py' | xargs ruff check --select Q --select I --select F401 --select UP026 --select UP034 --select UP039 --select W292 --fix
    fi

    # Applying Black format with `darker` with options:
    # --isort: Using isort
    # --revision: Compare changes with revision $BASE_REVISION
    echo "Using darker..."
    if [ -n "$GOSU_USER" ]; then
        gosu "$GOSU_USER" darker --isort --revision "$BASE_REVISION"
    else
        darker --isort --revision "$BASE_REVISION"
    fi
else
    echo "No Python changes detected!"
fi
