#!/bin/bash

if [ -z "$(dpkg -l|grep 'libpq-dev')" ]; then
  echo "Installing dependencies needed to pip-compile..."
  apt-get -qq update && apt-get -qq -y install gcc libpq-dev
fi

for in_file in dependencies/pip/*.in
do
    # pass any arguments to pip-compile
    # useful for switches like `--upgrade-package`
    pip-compile "$@" "$in_file" || exit $?
done
for out_file in dependencies/pip/*.txt
