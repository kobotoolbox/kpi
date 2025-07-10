#!/usr/bin/env bash

# Inspired by https://blog.joshuins.com/implementing-cascading-merges-in-github-actions-part-1-99a907e566f3

set -eu

current_branch=`git rev-parse --abbrev-ref HEAD`
echo "current_branch=${current_branch}" >> $GITHUB_OUTPUT

release_version=`echo "${current_branch}" | cut -d '/' -f 2`
minor=`echo "${release_version}" | cut -d '.' -f 2`
patch=`echo "${release_version}" | cut -d '.' -f 3`

counter=0
next_branch="$current_branch-this-branch-surely-doesnt-exist"
until git ls-remote --exit-code --heads origin "refs/heads/$next_branch"
do
    # If this is the latest release, merge back to main.
    counter=$[counter+1]
    if [ $counter -ge 50 ]; then
        next_branch="main"
        break
    fi

    # Handling week number wrapping around in a new year.
    if [[ "${patch}" = "53" ]]
    then
        minor="0$(expr $minor + 1)"
        patch="1"
    else
        minor="${minor}"
        patch="$(expr $patch + 1)"
    fi

    patch=`printf '%02d' ${patch}`
    next_branch="release/2.${minor}.${patch}"
done

echo "next_branch=${next_branch}" >> $GITHUB_OUTPUT
echo "Next release branch: '${next_branch}'"
