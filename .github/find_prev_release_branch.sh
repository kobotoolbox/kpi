#!/usr/bin/env bash



set -eu

current_branch=`git rev-parse --abbrev-ref HEAD`

release_version=`echo "${current_branch}" | cut -d '/' -f 2`
minor=`echo "${release_version}" | cut -d '.' -f 2`
patch=`echo "${release_version}" | cut -d '.' -f 3`
current_tag="2.${minor}.${patch}"

echo "current_tag=${current_tag}" >> $GITHUB_OUTPUT
echo "current_branch=${current_branch}" >> $GITHUB_OUTPUT

counter=0
prev_branch="$current_branch-this-branch-surely-doesnt-exist"
until git ls-remote --exit-code --branches origin "refs/heads/$prev_branch"
do
    # If this is the latest release, merge back to main.
    counter=$[counter+1]
    if [ $counter -ge 50 ]; then
        exit 1
        break
    fi

    # Handling week number wrapping around in a new year.
    if [[ "${patch}" = "01" ]]
    then
        minor="0$(expr $minor - 1)"
        patch="53"
    else
        minor="${minor}"
        patch="$(expr $patch - 1)"
    fi

    patch=`printf '%02d' ${patch}`
    prev_tag="2.${minor}.${patch}"
    prev_branch="release/${prev_tag}"
    echo "checking branch '$prev_branch'.."
done

echo "prev_tag=${prev_tag}" >> $GITHUB_OUTPUT
echo "prev_branch=${prev_branch}" >> $GITHUB_OUTPUT
echo "Previous release branch: '${prev_branch}'"

if git ls-remote --exit-code --tags origin "$prev_tag"; then
    echo "prev_released=true" >> $GITHUB_OUTPUT
else
    echo "prev_released=false" >> $GITHUB_OUTPUT
fi
