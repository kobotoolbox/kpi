#!/usr/bin/env bash
set -e
set +x


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

echo -e '\n\n### Step: Set up Python'
echo 'Disclaimer: CI installs Python 3.10. Please eyeball if your local env has 3.10.'
python --version

echo -e '\n\n### Step: Install pip dependencies'
python -m pip install darker[isort] flake8 flake8-quotes isort --quiet

echo -e '\n\n### Step: Run Darker'
echo 'Disclaimer: CI runs Darker only on the last commit.. I think?'
darker --check --isort -L "flake8 --max-line-length=88 --extend-ignore=F821" kpi kobo hub


echo -e '\n\n## Job: Pytest'

echo -e '\n\n### Step: Set up Python'
echo 'Disclaimer: CI installs Python 3.10. Please eyeball if your local env has 3.10.'
python --version

echo -e '\n\n### Step: Install pip-tools'
python -m pip install pip-tools==7.\*

echo -e '\n\n### Step: Update Debian package lists'
DEBIAN_FRONTEND=noninteractive apt-get -qq -y update

echo -e '\n\n### Step: Install Debian dependencies'
DEBIAN_FRONTEND=noninteractive apt-get -qq -y install gdal-bin gettext libproj-dev postgresql-client ffmpeg gcc libc-dev build-essential

echo -e '\n\n### Step: Install Python dependencies'
pip-sync -q dependencies/pip/dev_requirements.txt

echo -e '\n\n### Step: Update translations'
git submodule init && git submodule update --remote && python manage.py compilemessages

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
