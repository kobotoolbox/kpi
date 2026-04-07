#!/usr/bin/env bash
set -e


export KOBOFORM_SRC_DIR=${KOBOFORM_SRC_DIR:-"$(cd $(dirname $0)/.. && pwd)/"}

echo 'Downloading translations from Transifex.'
(cd ${KOBOFORM_SRC_DIR} && tx pull -a -f --mode reviewed)

echo 'Compiling translations.'
(cd ${KOBOFORM_SRC_DIR} && python manage.py compilemessages)
echo 'Compilation complete.'
echo ''
echo 'Please commit the updated translations:'
echo '  git add locale'
echo '  git commit -m "chore(locale): update translations from transifex"'
