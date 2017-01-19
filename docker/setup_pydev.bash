#!/usr/bin/env bash
set -e

if [[ ! -d /srv/pydev_orig ]]; then
    echo 'Directory `/srv/pydev_orig` must exist to use PyDev debugger (see `kobo-docker/docker-compose.yml`).'
    exit 1
fi

cp -a /srv/pydev_orig /srv/pydev

if [[ -z "${KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS}" ]]; then
    echo '`KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS` must be set to use the PyDev debugger (see `kobo-docker/envfiles/kpi.txt`).'
    exit 1
fi

find_string='PATHS_FROM_ECLIPSE_TO_PYTHON = []'
replace_string="\
import os\n\
path_map_pair_strings = os.environ['KPI_PATH_FROM_ECLIPSE_TO_PYTHON_PAIRS'].split('|')\n\
PATHS_FROM_ECLIPSE_TO_PYTHON = [tuple([pair_element.strip() for pair_element in pair_string.split('->')]) for pair_string in path_map_pair_strings]\n\
"

escaped_find_sting="$(echo "${find_string}" | sed -e 's/[]\/$*.^|[]/\\&/g')"
escaped_replace_string=$(echo "${replace_string}" | sed -e '/\\n/b; s/[]\/$*.^|[]/\\&/g')

sed -i "s/${escaped_find_sting}/${escaped_replace_string}/" /srv/pydev/pydevd_file_utils.py

echo 'export PYTHONPATH=${PYTHONPATH}:/srv/pydev' > /etc/profile.d/pydev_debugger.bash.sh
