#!/bin/bash
set -eox
source /etc/profile

# If you've been doing this:
# 
#       ./run.py -cf run --rm --publish 3000:3000 kpi \
#                                    npm run watch && \
#                            ./run.py -cf restart kpi
#
# Or this:
#
#       ./run.py -cf run --rm --publish 3000:3000 kpi npm run watch ; \
#                            docker restart kobofe-kpi-1"
#
#
# Both of these will probably fail now that node_modules isn't in the
# container anymore.
#
# If you want a workflow like it now, do this?
#
#       ./run.py -cf run --rm --publish 3000:3000 kpi \
#                    ./docker/webpack-dev-server.sh ; \
#                            ./run.py -cf restart kpi

echo "Syncing \`npm\` packages…"
if ( ! check-dependencies ); then
    npm install
else
    npm run postinstall
fi

echo "Starting webpack-dev-server…"
npm run watch

