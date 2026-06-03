from django.db import migrations


def add_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.create(
        name='0024_migrate_submission_supplement_qpaths'
    )


def delete_long_running_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(
        name='0024_migrate_submission_supplement_qpaths'
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0023_migrate_submission_supplements'),
    ]

    operations = [
        migrations.RunPython(add_long_running_migration, delete_long_running_migration),
    ]
