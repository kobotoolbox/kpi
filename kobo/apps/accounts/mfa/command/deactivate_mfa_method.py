# coding: utf-8
from django.db.transaction import atomic
from trench.command.deactivate_mfa_method import DeactivateMFAMethodCommand
from trench.exceptions import MFANotEnabledError
from trench.utils import get_mfa_model


class DeactivateAllMfaMethodCommand(DeactivateMFAMethodCommand):
    """
    Overload `django-trench` behaviour introduced with v0.3.0 which blocks the
    deactivation of primary MFA method.
    See https://github.com/merixstudio/django-trench/blob/990c0e9687eb8ed219d0d04a5cd69f71b27ec43b/trench/command/deactivate_mfa_method.py#L17-L18
    """
    @atomic
    def execute(self, mfa_method_name: str, user_id: int) -> None:
        mfa = self._mfa_model.objects.get_by_name(user_id=user_id, name=mfa_method_name)
        if not mfa.is_active:
            raise MFANotEnabledError()

        self._mfa_model.objects.filter(user_id=user_id, name=mfa_method_name).update(
            is_active=False
        )


deactivate_mfa_method_command = DeactivateAllMfaMethodCommand(
    mfa_model=get_mfa_model()
).execute
