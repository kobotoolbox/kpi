from constance import config
from django.core.exceptions import ValidationError
from kobo.apps.accounts.mfa.models import MfaMethod

def validate_superuser_auth(obj):
    if (
        obj.is_superuser
        and config.SUPERUSER_AUTH_ENFORCEMENT
        and obj.has_usable_password()
        and not MfaMethod.objects.filter(user=obj, is_active=True).exists()
    ):
        raise ValidationError('Superusers with a usable password must enable MFA.')

