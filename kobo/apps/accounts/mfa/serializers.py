from allauth.mfa.base.internal.flows import check_rate_limit
from allauth.mfa.models import Authenticator
from django.contrib.auth.hashers import check_password, identify_hasher
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from .utils import MFA_METHOD_NAME


class UserMfaMethodSerializer(serializers.Serializer):
    """
    Exposes user's MFA methods and their created, modified and disabled dates

    Built from the TOTP `Authenticator`, which only exists while MFA is on.
    The response keeps the shape of the former `MfaMethodsWrapper` model.
    """

    name = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(source='created_at')
    date_modified = serializers.DateTimeField(source='created_at')
    date_disabled = serializers.SerializerMethodField()

    def get_name(self, obj) -> str:
        return MFA_METHOD_NAME

    def get_is_active(self, obj) -> bool:
        return True

    def get_date_disabled(self, obj) -> None:
        # allauth deletes the authenticator when MFA is turned off
        return None


class MfaCodeSerializer(serializers.Serializer):
    """
    Intended to be used for validating TOTP and recovery codes
    """

    code = serializers.CharField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = self.context['user']
        self.method = self.context['method']
        if self.method != MFA_METHOD_NAME:
            raise NotFound

        authenticators = {
            authenticator.type: authenticator
            for authenticator in Authenticator.objects.filter(
                user_id=self.user.pk,
                type__in=[
                    Authenticator.Type.TOTP,
                    Authenticator.Type.RECOVERY_CODES,
                ],
            )
        }
        if Authenticator.Type.TOTP not in authenticators:
            raise NotFound

        # TOTP first, then recovery codes, which may be missing
        self.authenticators = [
            authenticators[auth_type]
            for auth_type in (
                Authenticator.Type.TOTP,
                Authenticator.Type.RECOVERY_CODES,
            )
            if auth_type in authenticators
        ]

    def validate_code(self, code):
        clear_rl = check_rate_limit(self.user)
        for auth in self.authenticators:
            if auth.wrap().validate_code(code):
                self.authenticator = auth
                clear_rl()
                return code
            if auth.type == Authenticator.Type.RECOVERY_CODES:
                hashed_code = self.validate_migrated_codes(code, auth.wrap())
                if hashed_code is not None:
                    self.authenticator = auth
                    clear_rl()
                    return code

        raise ValidationError('Invalid code')

    def validate_migrated_codes(self, input_code, recovery_codes) -> str | None:
        codes = recovery_codes._get_migrated_codes()  # noqa

        if codes is None:
            return None

        try:
            identify_hasher(codes[0])
        except ValueError:
            return None

        # if codes are hashed do the recovery codes logic
        for idx, hashed_code in enumerate(codes):
            if check_password(input_code, hashed_code):
                recovery_codes.validate_code(hashed_code)
                return hashed_code

        return None
