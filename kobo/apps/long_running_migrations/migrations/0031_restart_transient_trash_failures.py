from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.get_or_create(
        name='0031_restart_transient_trash_failures',
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0030_reprocess_failed_root_uuid'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
