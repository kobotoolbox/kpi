#!/bin/bash
set -e

[ -e /tmp/computed_vars.source.bash ] && source /tmp/computed_vars.source.bash

/usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"