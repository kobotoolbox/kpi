# Generated on 2026-07-08

from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.get_or_create(
        name='0028_sync_mongo_root_uuid',
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0027_backfill_remaining_root_uuid'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
