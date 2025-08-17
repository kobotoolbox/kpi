#!/usr/bin/env bash
set -e
set +x

# Detect who is the owner, permissions are not the same depending on the host
# (e.g.: linux = kobo, macOs = root)
WHOAMI=$(whoami)
OWNER=$(ls -ld . | awk '{print $3}')
GOSU_USER=""
DESTINATION_FOLDER="${KPI_SRC_DIR}/static/openapi"

if [ "$WHOAMI" != "$OWNER" ]; then
    GOSU_USER=$OWNER
fi

if [ ! -d "$DESTINATION_FOLDER" ]; then
    echo "Creating destination folder…"
    if [ -n "$GOSU_USER" ]; then
        gosu "$GOSU_USER" mkdir -p "$DESTINATION_FOLDER"
    else
        mkdir -p "$DESTINATION_FOLDER"
    fi
    echo "Done!"
fi

echo "Generating files…"
if [ -n "$GOSU_USER" ]; then
    echo "Creating v2 JSON schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
    echo "Creating v2 YAML schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.yaml" --schema="api_v2"
    echo "Creating OpenRosa JSON schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
    echo "Creating OpenRosa YAML schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.yaml" --schema="openrosa"

    echo "Copying schema files to nginx volume…"
    gosu "$GOSU_USER" rsync -aq --delete --chown=www-data "$DESTINATION_FOLDER/" "${NGINX_STATIC_DIR}/openapi/"
else
    echo "Creating v2 JSON schema…"
    python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
    echo "Creating v2 YAML schema…"
    python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_v2.yaml" --schema="api_v2"
    echo "Creating OpenRosa JSON schema…"
    python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
    echo "Creating OpenRosa YAML schema…"
    python manage.py generate_openapi_schema --file "$DESTINATION_FOLDER/schema_openrosa.yaml" --schema="openrosa"

    echo "Copying schema files to nginx volume…"
    rsync -aq --delete --chown=www-data "$DESTINATION_FOLDER/" "${NGINX_STATIC_DIR}/openapi/"

fi
echo "Done!"
