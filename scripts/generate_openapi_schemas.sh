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
SRC_FOLDER="./static/openapi"
DESTINATION_FOLDER="./staticfiles/openapi"

# For example, `bash -c`` will run on CI, while `gosu` will run in docker.
function run () { bash -c "$*"; }
if [ "$WHOAMI" != "$OWNER" ]; then
    echo "Applied gosu!"
    function run () { gosu "$GOSU_USER" $*; }
fi

if [ ! -d "$SRC_FOLDER" ]; then
    echo "Creating source folder…"
    run mkdir -p "$SRC_FOLDER"
    echo "Done!"
fi
if [ ! -d "$DESTINATION_FOLDER" ]; then
    echo "Creating destination folder…"
    run mkdir -p "$DESTINATION_FOLDER"
    echo "Done!"
fi

echo "Generating files…"
echo "Creating v2 JSON schema…"
run python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.json" --schema="api_v2" --format openapi-json
run cp -f "$SRC_FOLDER/schema_v2.json" "$DESTINATION_FOLDER/schema_v2.json"
echo "Creating v2 YAML schema…"
run python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_v2.yaml" --schema="api_v2"
run cp -f "$SRC_FOLDER/schema_v2.yaml" "$DESTINATION_FOLDER/schema_v2.yaml"
echo "Creating OpenRosa JSON schema…"
run python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.json" --schema="openrosa" --format openapi-json
run cp -f "$SRC_FOLDER/schema_openrosa.json" "$DESTINATION_FOLDER/schema_openrosa.json"
echo "Creating OpenRosa YAML schema…"
run python manage.py generate_openapi_schema --file "$SRC_FOLDER/schema_openrosa.yaml" --schema="openrosa"
run cp -f "$SRC_FOLDER/schema_openrosa.yaml" "$DESTINATION_FOLDER/schema_openrosa.yaml"
echo "Done!"
