from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.get_or_create(
        name='0033_add_submission_tz',
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0032_restart_empty_error_trash_failures'),
        ('viewer', '0008_update_submission_time_format'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
