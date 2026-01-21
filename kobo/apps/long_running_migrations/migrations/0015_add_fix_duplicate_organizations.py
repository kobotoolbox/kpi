from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(name='0015_fix_duplicate_organizations')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0014_merge_20251205_1305'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
