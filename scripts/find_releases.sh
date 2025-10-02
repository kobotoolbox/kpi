#!/usr/bin/env bash

# Usage examples:
#    ./scripts/find_releases.sh                     # defaults to current branch (git rev-parse --abbrev-ref HEAD)
#    ./scripts/find_releases.sh "release/2.025.29"  # explicit parameter
#    npm run changelog                              # see how this script is used to generate a changelog.

set -euo pipefail

# For debugging, be able to run locally outside of GHA context.
if [ -z "${GITHUB_OUTPUT+x}" ]; then
    GITHUB_OUTPUT='/dev/stderr'
fi

## Find current version. Note: current_patch is the version that's not yet but about to be released.

current_branch="${1-}"
if [[ -z "${current_branch}" ]]; then current_branch=$(git rev-parse --abbrev-ref HEAD); fi;

current_minor=`echo "${current_branch}" | cut -d '/' -f 2`

current_patch="$(git tag -l $current_minor* | tail -1)"
if [[ $current_patch == "" ]]; then
    current_patch=$current_minor
elif [[ $current_patch == $current_minor ]]; then
    current_patch="${current_minor}a"
else
    current_patch="$(echo ${current_patch%?})$(echo -n "$current_patch" | tail -c1 | tr "0-9a-z" "1-9a-z_")"
fi
echo "Current release branch: '${current_branch}'"
echo "Current patch version: '${current_patch}'"

if [[ $current_branch != "release/"* ]]; then
    echo "ERROR: Please checkout a release branch instead."
    exit 1
fi
echo "current_branch=${current_branch}" >> $GITHUB_OUTPUT
echo "current_minor=${current_minor}" >> $GITHUB_OUTPUT
echo "current_patch=${current_patch}" >> $GITHUB_OUTPUT


# Find previous version. Note: prev_patch is the patch of minor that's already released, empty if minor is not released.

counter=0
prev_minor_year=`echo "${current_minor}" | cut -d '.' -f 2`
prev_minor_week=`echo "${current_minor}" | cut -d '.' -f 3`
prev_branch="$current_branch-this-branch-surely-doesnt-exist"
until git show-branch "origin/$prev_branch" 1>> /dev/null 2>> /dev/null
do
    # If this is the latest release, merge back to main.
    counter=$[counter+1]
    if [ $counter -ge 50 ]; then
        exit 1
        break
    fi

    # Handling week number wrapping around in a new year.
    if [[ "${prev_minor_week}" = "01" ]]
    then
        prev_minor_year="0$(expr $prev_minor_year - 1)"
        prev_minor_week="53"
    else
        prev_minor_year="${prev_minor_year}"
        prev_minor_week="$(expr $prev_minor_week - 1)"
    fi

    prev_minor_week=`printf '%02d' ${prev_minor_week}`
    prev_minor="2.${prev_minor_year}.${prev_minor_week}"
    prev_branch="release/${prev_minor}"
    # echo "..checking branch '$prev_branch'.." # debug
done

echo "prev_minor=${prev_minor}" >> $GITHUB_OUTPUT
prev_patch="$(git tag -l $prev_minor* | tail -1)"
echo "prev_patch=${prev_patch}" >> $GITHUB_OUTPUT
echo "prev_branch=${prev_branch}" >> $GITHUB_OUTPUT
echo "Previous release branch: '${prev_branch}'"
echo "Previous patch version: '${prev_patch}'"

if [[ $prev_patch == "" ]]; then
    echo "prev_released=false" >> $GITHUB_OUTPUT
else
    echo "prev_released=true" >> $GITHUB_OUTPUT
fi

# Find next version. Note: next_patch is the patch of minor that's already released, empty if minor is not released.

counter=0
next_minor_year=`echo "${current_minor}" | cut -d '.' -f 2`
next_minor_week=`echo "${current_minor}" | cut -d '.' -f 3`
next_branch="$current_branch-this-branch-surely-doesnt-exist"
until git show-branch "origin/$next_branch" 1>> /dev/null 2>> /dev/null
do
    # If this is the latest release, merge back to main.
    counter=$[counter+1]
    if [ $counter -ge 50 ]; then
        next_branch="main"
        next_minor=""
        break
    fi

    # Handling week number wrapping around in a new year.
    if [[ "${next_minor_week}" = "53" ]]
    then
        next_minor_year="0$(expr $next_minor_year + 1)"
        next_minor_week="1"
    else
        next_minor_year="${next_minor_year}"
        next_minor_week="$(expr $next_minor_week + 1)"
    fi

    next_minor_week=`printf '%02d' ${next_minor_week}`
    next_minor="2.${next_minor_year}.${next_minor_week}"
    next_branch="release/${next_minor}"
    # echo "..checking branch '$next_branch'.." # debug
done

echo "next_minor=${next_minor}" >> $GITHUB_OUTPUT
next_patch="$(git tag -l $next_minor* | tail -1)"
echo "next_patch=${next_patch}" >> $GITHUB_OUTPUT
echo "next_branch=${next_branch}" >> $GITHUB_OUTPUT
echo "Next release branch: '${next_branch}'"
echo "Next patch version: '${next_patch}'"
