from __future__ import annotations

from contextlib import contextmanager

from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django_celery_beat.models import ClockedSchedule, PeriodicTask, PeriodicTasks


@contextmanager
def temporarily_disconnect_signals(save=False, delete=False):
    """
    Temporarily disconnects `PeriodicTasks` signals to prevent accumulating
    update queries for Celery Beat while bulk operations are in progress.

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

    # Force celery beat scheduler to refresh
    PeriodicTasks.update_changed()
