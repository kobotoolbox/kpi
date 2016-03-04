#!/bin/bash
set -e

source /etc/profile

/usr/local/bin/uwsgi --ini "${KPI_SRC_DIR}/uwsgi.ini"