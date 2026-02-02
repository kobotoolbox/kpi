#!/bin/bash
# 
#   Convenience script. Start the webpack dev server
#   in a temporary container from the host:
# 
#     ./kobo-install/run.py -cf run --rm --publish 3000:3000 \
#         kpi bash ./docker/webpack-dev-server.sh
#
#   This should launch successfully even if `node_modules` 
#   is removed from the built image.
#
set -e
(check-dependencies || npm install) && npm run watch
