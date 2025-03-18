#!/usr/bin/env bash
set -e
set +x

# Detect who is the owner, permissions are not the same depending on the host
# (e.g.: linux = kobo, macOs = root)
WHOAMI=$(whoami)
OWNER=$(ls -ld . | awk '{print $3}')
GOSU_USER=""

if [ "$WHOAMI" != "$OWNER" ]; then
    GOSU_USER=$OWNER
fi

echo -e '\n\n# Run CI jobs locally'
echo 'Disclaimer: local environment may differ from Github Actions environment.'

echo -e '\n\n### Step: Setup Node'
echo 'Disclaimer: CI installs a matrix of v20.17.0 and 22, this script checks against v20.17.0.'
npm run hint
echo 'Disclaimer: CI caches node_modules, this script does not.'

echo -e '\n\n### Step: Install JavaScript dependencies (npm install)'
npm install

echo -e '\n\n### Step: Run all linters, builds and tests'
npm run ci


echo -e '\n\n## Job: Darker'

echo -e '\n\n### Step: Run Darker'
echo 'Disclaimer: CI runs Darker only on the last commit and the remote branch'

if [ -n "$GOSU_USER" ]; then
    CURRENT_BRANCH=$(gosu "$GOSU_USER" git rev-parse --abbrev-ref HEAD)
    gosu $GOSU_USER darker --check --isort -L "flake8 --max-line-length=88 --extend-ignore=F821" kpi kobo hub -r "origin/$CURRENT_BRANCH"
else
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    darker --check --isort -L "flake8 --max-line-length=88 --extend-ignore=F821" kpi kobo hub -r "origin/$CURRENT_BRANCH"
fi


echo -e '\n\n## Job: Pytest'

echo -e '\n\n### Step: Update translations'
if [ -n "$GOSU_USER" ]; then
    gosu "$GOSU_USER" git submodule init
    gosu "$GOSU_USER" git submodule update --remote
    gosu "$GOSU_USER" python manage.py compilemessages
else
    git submodule init && git submodule update --remote && python manage.py compilemessages
fi
echo -e '\n\n### Step: Test back-end code'
echo 'Disclaimer: CI uses pytest with coverage option, this script does not.'
# Speed-up pytest by running tests in parallel
pytest -q --disable-warnings -n auto || true
# Run only the last failed tests sequentially.
# Tests that previously failed due to concurrency should pass now.
# If they still fail, it indicates genuine test failures.
pytest -q --disable-warnings --lf -rf

echo -e '\n\n### Step: Run coveralls for back-end code'
echo 'Disclaimer: CI uses external action, this script does not.'

echo -e '\n\n# End. If you see this, everything succeeded.'
