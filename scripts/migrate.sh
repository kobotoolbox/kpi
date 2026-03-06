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
        DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py shell <<EOF
from django.conf import settings
from django.core.management import call_command
from kobo.apps.long_running_migrations.models import LongRunningMigration

if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
    print("⏭️ SKIP_HEAVY_MIGRATIONS is enabled. Deferring view recreation to background Celery task...")
    LongRunningMigration.objects.filter(name='0019_recreate_user_reports_mv').update(status='created')
else:
    print("⏳ Restoring the user_reports_userreportsmv view synchronously (this may take several minutes)...")
    call_command('manage_user_reports_mv', create=True)
EOF
        echo "Schema lock resolved successfully."
    else
        echo "KPI migrations failed for an unknown reason."
        exit $MIGRATE_STATUS
    fi
fi
echo '########## KoboCAT migrations ############'
DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate --noinput --database kobocat
python manage.py runscript create_anonymous_user
