from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(
        name='0020_sync_auditlog_object_id'
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('audit_log', '0016_auditlog_object_id_tmp'),
        ('long_running_migrations', '0019_recreate_user_reports_mv'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
