from django.db import migrations

from kobo.apps.user_reports.utils.migrations import DROP_MV_SQL


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0022_sync_mfa_profiles')


def reset_user_reports_mv_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(
        name='0019_recreate_user_reports_mv'
    ).update(status='created')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0021_restart_failed_migrations'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
        migrations.RunSQL(sql=DROP_MV_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunPython(reset_user_reports_mv_migration, noop),
    ]
