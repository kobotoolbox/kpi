#!/bin/bash

set -x  # give the human some hope of progress

for in_file in dependencies/pip/*.in
do
    # pass any arguments to uv pip compile
    # useful for switches like `--upgrade-package`
    uv pip compile "$@" "$in_file" || exit $?
done
