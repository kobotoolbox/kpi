from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(
        name__in=[
            '0005_backfill_logger_instance_root_uuid',
            '0011_backfill_exceeded_limit_counters',
            '0013_migrate_mfa_data',
        ]
    ).exclude(status='completed').update(status='created')


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0017_remove_organizations_of_deleted_users'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, noop),
    ]
