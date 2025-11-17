from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )  # noqa
    LongRunningMigration.objects.create(name='0011_backfill_exceeded_limit_counters')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0010_remove_from_kc_only_permission'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
