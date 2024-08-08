from logging import getLogger

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from .models import AuditLog

logger = getLogger(__name__)


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logger.warning('Request does not have authenticated user attached.')
        log = AuditLog.create_access_log_for_request(request, user)
    else:
        log = AuditLog.create_access_log_for_request(request)
    log.save()
