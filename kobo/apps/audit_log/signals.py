from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from kpi.utils.log import logging
from .models import AuditLog


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logging.warning('Request does not have authenticated user attached.')
        log = AuditLog.create_access_log_for_request(request, user)
    else:
        log = AuditLog.create_access_log_for_request(request)
    log.save()
