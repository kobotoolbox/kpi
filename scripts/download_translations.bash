#!/usr/bin/env bash
set -e


export KOBOFORM_SRC_DIR=${KOBOFORM_SRC_DIR:-"$(cd $(dirname $0)/.. && pwd)/"}

echo 'Downloading translations from Transifex.'
(cd ${KOBOFORM_SRC_DIR} && tx pull --all)
# FIXME: Don't pull "pseudo-translations" once we have real translations.
(cd ${KOBOFORM_SRC_DIR} && tx pull --all --pseudo)

echo 'Compiling translations.'
(cd ${KOBOFORM_SRC_DIR} && python manage.py compilemessages)
echo 'Compiliation complete!'
