#!/bin/bash
set -e

source /etc/profile

pip install coverage
(cd "${KPI_SRC_DIR}" && \
    coverage run --source='hub,kpi,kobo' --omit='*/tests/*,*/migrations/*,*/management/commands/*' manage.py test && \
    coverage xml \
) 

npm run test
