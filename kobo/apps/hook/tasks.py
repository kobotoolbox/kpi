# -*- coding: utf-8 -*-
from celery import shared_task
from django.conf import settings


@shared_task(bind=True)
def service_definition_task(self, hook, data):
    """
    Tries to send data to the endpoint of the hook
    It retries 3 times maximum.
    - after 1 minutes,
    - after 10 minutes,
    - after 100 minutes

    :param self: Celery.Task.
    :param hook: Hook.
    :param data: dict.
    """
    # Use camelcase (even if it's not PEP-8 compliant)
    # because variable represents the class, not the instance.
    ServiceDefinition = hook.get_service_definition()
    service_definition = ServiceDefinition(hook, data)
    if not service_definition.send():
        # Countdown is in seconds
        countdown = 60 #60 * (10 ** self.request.retries)
        raise self.retry(countdown=countdown, max_retries=settings.HOOK_MAX_RETRIES)

    return True