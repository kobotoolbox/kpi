from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(
        name='0005_backfill_logger_instance_root_uuid'
    ).exclude(status='completed').update(status='created')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0015_add_fix_duplicate_organizations'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
