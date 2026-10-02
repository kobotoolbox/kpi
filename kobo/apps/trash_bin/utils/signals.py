from __future__ import annotations

from contextlib import contextmanager

from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django_celery_beat.models import ClockedSchedule, PeriodicTask, PeriodicTasks


@contextmanager
def temporarily_disconnect_signals(save=False, delete=False):
    """
    Temporarily disconnects `PeriodicTasks` signals to prevent accumulating
    update queries for Celery Beat while bulk operations are in progress.

    Celery Beat is not told about the changes made inside the block, on
    purpose. `PeriodicTasks.update_changed()` locks the single row Beat
    watches (`SELECT ... FOR UPDATE`) until the caller's transaction commits,
    so concurrent callers (e.g. `move_to_trash()` from many workers) end up
    waiting on each other, one at a time. It is also not needed: since
    django-celery-beat 2.9.0, Beat reloads its schedule every 5 minutes
    (`SCHEDULE_SYNC_MAX_INTERVAL`) and only loads clocked tasks due within the
    next 5 minutes. A task created or deleted here is picked up by the next
    reload, i.e. it may run up to 5 minutes late.

    See https://django-celery-beat.readthedocs.io/en/stable/reference/django-celery-beat.models.html#django_celery_beat.models.PeriodicTasks  # noqa: E501
    """

    try:
        if delete:
            pre_delete.disconnect(PeriodicTasks.changed, sender=PeriodicTask)
            post_delete.disconnect(PeriodicTasks.update_changed, sender=ClockedSchedule)
        if save:
            pre_save.disconnect(PeriodicTasks.changed, sender=PeriodicTask)
            post_save.disconnect(PeriodicTasks.update_changed, sender=ClockedSchedule)
        yield
    finally:
        if delete:
            post_delete.connect(PeriodicTasks.update_changed, sender=ClockedSchedule)
            pre_delete.connect(PeriodicTasks.changed, sender=PeriodicTask)
        if save:
            pre_save.connect(PeriodicTasks.changed, sender=PeriodicTask)
            post_save.connect(PeriodicTasks.update_changed, sender=ClockedSchedule)
