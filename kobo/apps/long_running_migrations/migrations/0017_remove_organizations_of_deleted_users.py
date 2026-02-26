from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(
        name='0017_remove_organizations_of_deleted_users'
    )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0016_restart_failed_0005'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
