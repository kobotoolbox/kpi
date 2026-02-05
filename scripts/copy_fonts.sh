#!/usr/bin/env bash

set -euo pipefail
shopt -s failglob # show filename expansion errors, if any

# Execute from the top level folder of the repo
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR/.."

FONT_DEST_DIR='./jsapp/fonts'
mkdir -p $FONT_DEST_DIR  # ensure the destination exists
echo "Copying fonts from node_modules to jsapp/fonts..."
cp -v ./node_modules/@fontsource/roboto/files/roboto-latin-ext-*.wof*            $FONT_DEST_DIR
cp -v ./node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-ext-*.wof*  $FONT_DEST_DIR
echo "DONE copying fonts."
