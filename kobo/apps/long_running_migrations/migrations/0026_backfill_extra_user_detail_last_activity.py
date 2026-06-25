from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(
        name='0026_backfill_extra_user_detail_last_activity'
    )


def delete_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(
        name='0026_backfill_extra_user_detail_last_activity'
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0025_reset_lrm_0024'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, delete_long_running_migration),
    ]
