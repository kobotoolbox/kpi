#!/usr/bin/env bash
set -e
set +x

echo 'Locally, this script is expected to be run from a container, for example like this:'
echo '   cd kobo-install'
echo '   ./run.py'
echo '   ./run.py -cf exec kpi ./scripts/generate_openapi_schemas.sh'

# Detect who is the owner, permissions are not the same depending on the host
# (e.g.: linux = kobo, macOs = root)
WHOAMI=$(whoami)
OWNER=$(ls -ld . | awk '{print $3}')
GOSU_USER=""
SRC_FOLDER="./static/openapi"
DESTINATION_FOLDER="./staticfiles/openapi"

if [ "$WHOAMI" != "$OWNER" ]; then
    GOSU_USER=$OWNER
fi

if [ ! -d "$SRC_FOLDER" ]; then
    echo "Creating source folder…"
    if [ -n "$GOSU_USER" ]; then
        gosu "$GOSU_USER" mkdir -p "$SRC_FOLDER"
    else
        mkdir -p "$SRC_FOLDER"
    fi
    echo "Done!"
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
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
    gosu "$GOSU_USER" cp -f "$SRC_FOLDER/schema_v2.json" "$DESTINATION_FOLDER/schema_v2.json"
    echo "Creating v2 YAML schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.yaml" --schema="api_v2"
    gosu "$GOSU_USER" cp -f "$SRC_FOLDER/schema_v2.yaml" "$DESTINATION_FOLDER/schema_v2.yaml"
    echo "Creating OpenRosa JSON schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
    gosu "$GOSU_USER" cp -f "$SRC_FOLDER/schema_openrosa.json" "$DESTINATION_FOLDER/schema_openrosa.json"
    echo "Creating OpenRosa YAML schema…"
    gosu "$GOSU_USER" python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.yaml" --schema="openrosa"
    gosu "$GOSU_USER" cp -f "$SRC_FOLDER/schema_openrosa.yaml" "$DESTINATION_FOLDER/schema_openrosa.yaml"
else
    echo "Creating v2 JSON schema…"
    python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
    cp -f "$SRC_FOLDER/schema_v2.json" "$DESTINATION_FOLDER/schema_v2.json"
    echo "Creating v2 YAML schema…"
    python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.yaml" --schema="api_v2"
    cp -f "$SRC_FOLDER/schema_v2.yaml" "$DESTINATION_FOLDER/schema_v2.yaml"
    echo "Creating OpenRosa JSON schema…"
    python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
    cp -f "$SRC_FOLDER/schema_openrosa.json" "$DESTINATION_FOLDER/schema_openrosa.json"
    echo "Creating OpenRosa YAML schema…"
    python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.yaml" --schema="openrosa"
    cp -f "$SRC_FOLDER/schema_openrosa.yaml" "$DESTINATION_FOLDER/schema_openrosa.yaml"
fi
echo "Done!"
