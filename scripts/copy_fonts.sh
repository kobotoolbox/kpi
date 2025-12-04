#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$script_dir/.." # go up above script folder

dest_dir='./jsapp/fonts'

# create folder if it doesn't exist
mkdir -p $dest_dir

# copy fonts
shopt -s failglob
echo "Copying fonts from node_modules to jsapp/fonts..."
cp -v ./node_modules/@fontsource/roboto/files/roboto-latin-ext-*.wof*           $dest_dir
cp -v ./node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-ext-*.wof* $dest_dir
echo "DONE copying fonts."
