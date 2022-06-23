#!/bin/bash
set -e

echo 'Waiting for container `mongo`.'
echo '--->' $KPI_MONGO_HOST
dockerize -timeout=40s -wait tcp://${KPI_MONGO_HOST}:${KPI_MONGO_PORT}
echo 'Container `mongo` up.'
