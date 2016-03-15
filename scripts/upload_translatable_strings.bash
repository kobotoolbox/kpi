#!/usr/bin/env bash
set -e


export KOBOFORM_SRC_DIR=${KOBOFORM_SRC_DIR:-"$(cd $(dirname $0)/.. && pwd)/"}

echo 'Extracting translatable strings from Django code.'
bash -c 'cd ${KOBOFORM_SRC_DIR} && python manage.py makemessages --locale en'

echo 'Extracting translatable strings from client code.'
bash -c 'cd ${KOBOFORM_SRC_DIR} && python manage.py makemessages --locale en --domain djangojs --extension es6'

echo 'Uploading translatable strings to Transifex.'
bash -c 'cd ${KOBOFORM_SRC_DIR} && tx push -s'
echo 'Upload complete!'
