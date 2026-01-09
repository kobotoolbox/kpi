#!/bin/bash

set -x  # give the human some hope of progress

for in_file in dependencies/pip/*.in
do
    out_file="${in_file%.*}.txt"

    # pass any arguments to uv pip compile
    # useful for switches like `--upgrade-package`
    uv pip compile "$@" "$in_file" --output-file "$out_file" \
        --no-strip-extras \
        --no-emit-package "setuptools" \
        || exit $?
done

# These arguments align uv to pip-tools<=7 defaults:
#   --no-strip-extras
#   --no-emit-package "setuptools" (omitted as 'unsafe' in pip-tools<=7)
#
# Otherwise, uv and pip-tools>=8 both default to
#   --strip-extras
#   --allow-unsafe
#
# See
#   - https://pip-tools.readthedocs.io/en/stable/#deprecations
#   - https://docs.astral.sh/uv/pip/compatibility/#pip-compile-defaults
