#!/bin/bash
set -e

source /etc/profile

python manage.py test
npm run test
