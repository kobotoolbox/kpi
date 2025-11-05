from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0013_migrate_mfa_data')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0012_remove_old_versions'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
