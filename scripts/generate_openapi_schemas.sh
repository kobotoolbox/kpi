#!/usr/bin/env bash
set -e
set +x

echo 'Locally, this script is expected to be run from a container, for example like this:'
echo '   cd kobo-install'
echo '   ./run.py -cf run --rm kpi ./scripts/generate_openapi_schemas.sh'

# Detect who is the owner, permissions are not the same depending on the host
# (e.g.: linux = kobo, macOs = root)
WHOAMI=$(whoami)
OWNER=$(ls -ld . | awk '{print $3}')
DESTINATION_FOLDER="${KPI_SRC_DIR}/static/openapi"

# For example, `bash -c`` will run on CI, while `gosu` will run in docker.
function run () { bash -c "$*"; }
if [ "$WHOAMI" != "$OWNER" ]; then
    echo "Applied gosu!"
    function run () { gosu "$GOSU_USER" $*; }
fi

if [ ! -d "$DESTINATION_FOLDER" ]; then
    echo "Creating destination folder…"
    run mkdir -p "$DESTINATION_FOLDER"
    echo "Done!"
fi

echo "Generating files…"
echo "Creating v2 JSON schema…"
run python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
echo "Creating v2 YAML schema…"
run python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.yaml" --schema="api_v2"
echo "Creating OpenRosa JSON schema…"
run python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
echo "Creating OpenRosa YAML schema…"
run python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.yaml" --schema="openrosa"

# Skip copy to NGINX volume if running the script from GitHub action workflow
if [ "$DJANGO_SETTINGS_MODULE" != "kobo.settings.testing" ]; then
    echo "Copying schema files to nginx volume…"
    rsync -aq --delete --chown=www-data "$DESTINATION_FOLDER/" "${NGINX_STATIC_DIR}/openapi/"
fi

echo "Done!"
