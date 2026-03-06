#!/usr/bin/env bash
set -e

python manage.py runscript fix_migrations_for_kobocat
python manage.py runscript fix_migrations_for_kpi
echo '########## KPI migrations ############'

# Disable immediate exit on error to capture the migration output and check for specific errors
set +e

# Run the migration and capture both output and exit status
MIGRATE_OUT=$(DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput 2>&1)
MIGRATE_STATUS=$?

set -e

# If the migration failed, check why it failed
if [ $MIGRATE_STATUS -ne 0 ]; then
    # Search the error output for the specific PostgreSQL view lock message
    if echo "$MIGRATE_OUT" | grep -q "cannot alter type of a column used by a view"; then
        echo "⚠️ Materialized view schema lock detected! Automatically resolving..."

        # Step A: Drop the view to remove the lock
        DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py manage_user_reports_mv --drop

        # Step B: Retry the migration now that the lock is gone
        echo "Retrying KPI migrations..."
        DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput

        # Step C: Recreate the view after successful migration
        DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py manage_user_reports_mv --create
        echo "Schema lock resolved successfully."
    else
        echo "KPI migrations failed for an unknown reason."
        exit $MIGRATE_STATUS
    fi
else
    echo "$MIGRATE_OUT"
fi
echo '########## KoboCAT migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput --database kobocat
python manage.py runscript create_anonymous_user
