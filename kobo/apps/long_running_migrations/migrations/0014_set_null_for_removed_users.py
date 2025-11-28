from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0014_set_null_for_removed_users')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0013_migrate_mfa_data'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
