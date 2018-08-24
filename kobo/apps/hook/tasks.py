# -*- coding: utf-8 -*-
from __future__ import absolute_import

import time

from celery import shared_task
from django.conf import settings

from .models import Hook, HookLog

@shared_task(bind=True)
def service_definition_task(self, hook_id, uuid):
    """
    Tries to send data to the endpoint of the hook
    It retries n times (n = `settings.HOOK_MAX_RETRIES`)

    - after 1 minutes,
    - after 10 minutes,
    - after 100 minutes
    etc ...

    :param self: Celery.Task.
    :param hook_id: int. Hook PK
    :param uuid: str. Instance.uuid
    """
    # Use camelcase (even if it's not PEP-8 compliant)
    # because variable represents the class, not the instance.
    hook = Hook.objects.get(id=hook_id)
    ServiceDefinition = hook.get_service_definition()
    service_definition = ServiceDefinition(hook, uuid)
    if not service_definition.send():
        # Countdown is in seconds
        countdown = 60 * (10 ** self.request.retries)
        raise self.retry(countdown=countdown, max_retries=settings.HOOK_MAX_RETRIES)

    return True


@shared_task
def retry_all_task(hook_logs):
    """
    :param list: <HookLog>.
    """
    for hook_log in hook_logs:
        hook_log.retry()
        time.sleep(0.2)

    return True