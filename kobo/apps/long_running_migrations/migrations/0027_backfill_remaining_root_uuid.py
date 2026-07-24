# Generated on 2026-06-23

from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.get_or_create(
        name='0027_backfill_remaining_root_uuid',
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0026_backfill_extra_user_detail_last_activity'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
