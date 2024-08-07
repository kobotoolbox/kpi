from logging import getLogger

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from .models import AuditLog

logger = getLogger(__name__)


@receiver(user_logged_in)
def test(sender, user, **kwargs):
    request = kwargs['request']
    AuditLog.create_auth_log_from_request(request)
