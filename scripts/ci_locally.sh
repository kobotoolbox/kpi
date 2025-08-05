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

run_parallel_pytest() {
    echo -n 'Running initial test pass '
    # Run pytest in the background and redirect output to a temporary file
    pytest -vv --disable-warnings -n auto > /tmp/pytest_output.log 2>&1 &
    pid=$!

    spinner='|/-\'
    progress="0%"

    # Loop while pytest is still running
    while kill -0 $pid 2>/dev/null; do
        # Extract the latest progress percentage from the pytest output log
        latest_progress=$(grep -o '[0-9]\+%' /tmp/pytest_output.log | tail -n 1)
        if [[ ! -z "$latest_progress" ]]; then
            progress=$latest_progress
        fi

        # Display the spinner and the current progress
        for i in `seq 0 3`; do
          echo -ne "\rRunning initial test pass ${spinner:i:1} $progress"
          sleep 0.2
        done

    done

    echo -e '\rRunning initial test pass ✔ 100%'
    rm -f /tmp/pytest_output.log
}

echo -e '\n\n# Run CI jobs locally'
echo 'Disclaimer: local container enviroment may differ from Github Actions environment.'
echo 'This script is expected to be run from a container, for example like this:'
echo '   cd kobo-install'
echo '   ./run.py'
echo '   ./run.py -cf exec kpi ./scripts/ci_locally.sh'


echo -e '\n\n## Job: npm-test'

# Uncomment lines below until this comment (https://github.com/kobotoolbox/kpi/pull/5593#discussion_r1999067788)
# is addressed.
# echo -e '\n\n### Step: Setup Node'
# echo 'Disclaimer: CI installs a matrix of v20.18.1 and 22, this script checks against v20.18.1.'
# npm run hint
# echo 'Disclaimer: CI caches node_modules, this script does not.'

echo -e '\n\n### Step: Install system dependencies for playwright'
npx playwright install-deps

echo -e '\n\n### Step: Install JavaScript dependencies'
npm install

echo -e '\n\n### Step: Run all linters, builds and tests'
npm run ci


echo -e '\n\n## Job: Darker'

echo -e '\n\n### Step: Run Darker'
echo 'Disclaimer: CI runs Darker only on the last commit and the remote branch'

# darker still exits with code 1 even with no errors on changes
# To avoid this:
# - capture the output
# - exit with darker exit code only if the output is not empty
set +e
if [ -n "$GOSU_USER" ]; then
    CURRENT_BRANCH=$(gosu "$GOSU_USER" git rev-parse --abbrev-ref HEAD)
    darker_output=$(gosu $GOSU_USER darker --check --isort -L "flake8 --max-line-length=88 --extend-ignore=F821" kpi kobo hub -r "origin/$CURRENT_BRANCH")
else
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    darker_output=$(darker --check --isort -L "flake8 --max-line-length=88 --extend-ignore=F821" kpi kobo hub -r "origin/$CURRENT_BRANCH")
fi
darker_status=$?
set -e

if [[ -n "$darker_output" ]]; then
    echo "$darker_output"
    exit $darker_status
else
    echo "✅ done!"
fi

echo -e '\n\n## Job: Pytest'

echo -e '\n\n### Step: Update translations'
if [ -n "$GOSU_USER" ]; then
    gosu "$GOSU_USER" git submodule init
    gosu "$GOSU_USER" git submodule update --remote
    gosu "$GOSU_USER" python manage.py compilemessages -v 0
else
    git submodule init && git submodule update --remote && python manage.py compilemessages -v 0
fi
echo -e '\n\n### Step: Test back-end code'
echo 'Disclaimer: CI uses pytest with coverage option, this script does not.'
# Speed-up pytest by running tests in parallel
run_parallel_pytest
# Run only the last failed tests sequentially.
# Tests that previously failed due to concurrency should pass now.
# If they still fail, it indicates genuine test failures.
echo -e '\nRunning final test pass'
pytest -q --disable-warnings --lf -rf

echo -e '\n\n### Step: Run coveralls for back-end code'
echo 'Disclaimer: CI uses external action, this script does not.'

echo -e '\n\n# End. If you see this, everything succeeded.'
