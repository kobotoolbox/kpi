#!/usr/bin/env bash

#
# Disjoint / Split mode
#
#   Run KPI in 2 separate parts, one for frontend and one for backend,
#   so the frontend and backend can be on different git branches.
#
# Run this script with two parameters:
#
#   split-frontend.sh  -b <backend_dir>  -f <frontend_dir>
#
# This will:
#
#   - Copy webpack-stats.json output from the frontend to the backend
#   - Re-copy continually (watch for changes to the frontend) until ^C.
#
# Before running, you'll need to do these steps manually:
#
#   1. Clone kpi in two different locations.
#   2. From <backend_dir>, start your backend server
#   3. From <frontend_dir>, start the frontend in watch mode (npm run watch)
#

backend=""
frontend=""

##
## Argument parsing
##

usage="Usage: $0 -b <backend_dir> -f <frontend_dir>"
help_deps="file watcher requires uvx or npx"

# Parse -b and -f flags
OPTIND=1
while getopts "h?b:f:" opt; do
    case "$opt" in
    b)  backend=$(realpath "$OPTARG");;
    f)  frontend=$(realpath "$OPTARG");;
    h|\?)
        echo "$usage"
        exit 0;;
    esac
done

# Exit with usage if -b or -f is missing
if [[ -z $frontend || -z $backend ]]; then
    echo "$usage"; exit 1; fi
if [[ "$frontend" == "$backend" ]]; then
    echo "frontend and backend directory should not be the same"; exit 1; fi

echo ""
echo "  backend:  $backend"
echo "  frontend: $frontend"
echo ""

set -euo pipefail


##
## Copy once
##
copy_cmd="cp ${frontend}/webpack-stats.json ${backend}/webpack-stats.json"

if [[ ! -f "${frontend}/webpack-stats.json" ]]
then echo "! Make sure to start the frontend ($frontend) with \`npm run watch\`"
else

    echo "+ $copy_cmd"
    echo ""

    # Warn if we encounter permissions problem
    set +e
    { error_output=$($copy_cmd 2>&1 >&3 3>&-); } 3>&1
    if [[ $? -ne 0 ]]; then
        echo "  !   Problem copying webpack-stats.json"
        if [[ $error_output =~ "denied" ]]; then
            echo "  !   You may need to change ownership if these files are owned by 'root'."
            echo "   "
            echo "          sudo chown -Rv $(id -un):$(id -gn) ${backend}"
            echo "   "
            echo "$(ls -al $backend | grep 'root')"
            exit 1
        fi
    fi
    set -e
fi

##
## Watch & copy until ^C
##

pattern='webpack-stats.json'
cd "$frontend" || exit 1

## Watcher: if uvx is available, use 'watchdog'
if command -v uvx >/dev/null 2>&1; then
    echo 'Watching "webpack-stats.json" ..'
    set -x
    uvx --from watchdog@6.0.0 \
        watchmedo \
            shell-command -w \
            --patterns="$pattern" \
            --command="$copy_cmd"
    exit 0
fi

## Watcher: if npx is available, use 'chokidar-cli'
if command -v npx >/dev/null 2>&1; then
    set -x
    npx --package=chokidar-cli@3.0.0 -- \
        chokidar \
            "${pattern}" \
            --command="${copy_cmd}"
    exit 0
fi

# Fallback: If none of the above watchers are available, print a warning.
echo "$help_deps"; exit 1
