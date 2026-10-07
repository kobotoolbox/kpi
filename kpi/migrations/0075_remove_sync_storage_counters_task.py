from django.db import migrations


def remove_sync_storage_counters_task(apps, schema_editor):
    """
    Remove the weekly `sync_storage_counters` task, which no longer exists.

    User storage is now summed from the user's projects, so the profile counter
    it compared them with is not updated anymore: left scheduled, it would find
    every profile out of sync and suspend submissions while recounting them.
    """

    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')  # noqa
    PeriodicTask.objects.filter(
        task='kobo.apps.openrosa.apps.logger.tasks.sync_storage_counters'
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('django_celery_beat', '0019_alter_periodictasks_options'),
        ('kpi', '0074_drop_reversion_tables'),
    ]

    operations = [
        migrations.RunPython(
            remove_sync_storage_counters_task, migrations.RunPython.noop
        ),
    ]
