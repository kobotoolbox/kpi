#!/usr/bin/env bash
set -e

export KOBOFORM_SRC_DIR="$(cd $(dirname $0)/.. && pwd)/"

echo 'Locally, this script can be run either from host or the from a container, for example like this:'
echo '   # from host'
echo '   cd kpi'
echo '   ./scripts/generate_translatable_strings.sh'
echo ''
echo '   # from container'
echo '   cd kobo-install'
echo '   ./run.py -cf run --rm kpi ./scripts/generate_translatable_strings.sh'
echo ''

echo 'Extracting translatable strings from Django code.'
(cd ${KOBOFORM_SRC_DIR} && python manage.py makemessages --locale en)

echo 'Extracting translatable strings from client code.'
(cd ${KOBOFORM_SRC_DIR} && python manage.py makemessages --locale en --domain djangojs)
