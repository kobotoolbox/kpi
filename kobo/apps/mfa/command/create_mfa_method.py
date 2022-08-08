# coding: utf-8
from trench.command.create_secret import create_secret_command
from trench.command.create_mfa_method import (
    CreateMFAMethodCommand as TrenchCreateMfAMethodCommand,
)
from trench.exceptions import MFAMethodAlreadyActiveError
from trench.models import MFAMethod
from trench.utils import get_mfa_model


class CreateMfaMethodCommand(TrenchCreateMfAMethodCommand):
    """
    Overload `django-trench` behaviour which keeps the same secret forever even
    if MFA method is disabled/enabled.
    See https://github.com/merixstudio/django-trench/blob/6a9f3f049b6c1d97fbfd05e0527b693e04c33891/trench/command/create_mfa_method.py#L14-L25

    When the client requests creation of a new MFA method, *always* create
    a new secret. The default django-trench behavior reuses old secrets,
    meaning that without this override, a given user would always see the
    same QR code no matter how many times they enabled and disabled MFA.
    That default behavior would create a security weakness if a user lost
    their original device, because deactivating MFA and reconfiguring it on
    a new device would not prevent the lost device from continuing to
    generate valid TOTPs.
    """
    def execute(self, user_id: int, name: str) -> MFAMethod:
        mfa, created = self._mfa_model.objects.get_or_create(
            user_id=user_id,
            name=name,
            defaults={
                'secret': self._create_secret,
                'is_active': False,
            },
        )
        if not created:
            if mfa.is_active:
                raise MFAMethodAlreadyActiveError()
            else:
                mfa.secret = self._create_secret()
                mfa.save()
        return mfa


create_mfa_method_command = CreateMfaMethodCommand(
    secret_generator=create_secret_command, mfa_model=get_mfa_model()
).execute
