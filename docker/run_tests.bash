#!/bin/bash
set -e

source /etc/profile

pytest
npm run test
