from django.db import migrations

TASK_NAME = 'Restore soft deleted attachments of a project'
TASK_PATH = 'kobo.apps.openrosa.apps.logger.tasks.restore_soft_deleted_attachments'


def add_periodic_task(apps, schema_editor):
    """
    Ship the row support edits and launches by hand.

    It is created here rather than declared in `CELERY_BEAT_SCHEDULE` because
    `DatabaseScheduler.setup_schedule()` runs `update_from_dict()` on every Beat
    startup, which would reset both `kwargs` and `enabled` on the row. The
    `asset_uid` typed by support would then disappear on the next deployment,
    and Beat would start running the job on its own against an empty one.
    """

    IntervalSchedule = apps.get_model('django_celery_beat', 'IntervalSchedule')
    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')

    # `PeriodicTask` needs a schedule to be saved, and this row never runs on
    # one: it stays disabled, and "Run selected tasks" ignores `enabled`
    schedule, _ = IntervalSchedule.objects.get_or_create(every=1, period='days')

    PeriodicTask.objects.get_or_create(
        name=TASK_NAME,
        defaults={
            'task': TASK_PATH,
            'interval': schedule,
            'enabled': False,
            # `dry_run` is spelled out rather than left to the default, so that
            # the one knob that makes a run write is visible to whoever opens
            # the row instead of having to be known about
            'kwargs': '{"asset_uid": "", "dry_run": true}',
            'description': (
                'Run by hand. Fill `asset_uid` in, then use "Run selected'
                ' tasks". Writes nothing until `dry_run` is turned to false,'
                ' which the management command spells `--no-dry-run`. Mails'
                ' its log to whoever launches it.'
            ),
        },
    )


def remove_periodic_task(apps, schema_editor):
    PeriodicTask = apps.get_model('django_celery_beat', 'PeriodicTask')
    PeriodicTask.objects.filter(name=TASK_NAME, task=TASK_PATH).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('kpi', '0074_drop_reversion_tables'),
        ('django_celery_beat', '0019_alter_periodictasks_options'),
    ]

    operations = [
        migrations.RunPython(add_periodic_task, remove_periodic_task),
    ]
