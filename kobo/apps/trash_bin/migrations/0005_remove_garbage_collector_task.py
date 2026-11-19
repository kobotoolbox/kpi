from django.db import migrations


def remove_garbage_collector_task(apps, schema_editor):
    """
    Remove the Celery Beat entry of the trash bin `garbage_collector` task.

    Its entry is gone from `CELERY_BEAT_SCHEDULE`, but Celery Beat keeps the
    `PeriodicTask` row that it created for it, and would keep sending the task.
    """

    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')  # noqa
    PeriodicTask.objects.filter(
        task='kobo.apps.trash_bin.tasks.garbage_collector'
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('django_celery_beat', '0019_alter_periodictasks_options'),
        ('trash_bin', '0004_attachmenttrash'),
    ]

    operations = [
        migrations.RunPython(remove_garbage_collector_task, migrations.RunPython.noop),
    ]
