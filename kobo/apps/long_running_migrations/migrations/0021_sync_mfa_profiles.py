from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0021_sync_mfa_profiles')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0020_backfill_asset_version_hash'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
