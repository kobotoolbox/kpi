from django.db import migrations


def restart_failed_migration(apps, schema_editor):
    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    try:
        lrm_0024 = LongRunningMigration.objects.get(
            name='0024_migrate_submission_supplement_qpaths'
        )
    except LongRunningMigration.DoesNotExist:
        # 0024 hasn't run yet; nothing to restart.
        return
    if lrm_0024.status == 'failed':
        lrm_0024.status = 'created'
        lrm_0024.error = f'previous error: {lrm_0024.error}'
        lrm_0024.save()


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('long_running_migrations', '0027_backfill_remaining_root_uuid'),
    ]

    operations = [
        migrations.RunPython(restart_failed_migration, noop),
    ]
