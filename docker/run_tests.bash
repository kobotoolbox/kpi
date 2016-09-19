#!/bin/bash
set -e

source /etc/profile

pip install coverage codacy-coverage
(cd "${KPI_SRC_DIR}" && \
    coverage run --source '.' manage.py test && \
    coverage xml && \
    python-codacy-coverage -r coverage.xml \
) 

npm run test
