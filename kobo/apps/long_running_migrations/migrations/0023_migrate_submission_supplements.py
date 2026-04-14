from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0023_migrate_submission_supplements')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0022_sync_mfa_profiles'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
