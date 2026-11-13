from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from .utils import MFA_METHOD_NAME, user_has_active_mfa, validate_mfa_code


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
        if not user_has_active_mfa(self.user):
            raise NotFound

    def validate_code(self, code):
        if authenticator := validate_mfa_code(self.user, code):
            self.authenticator = authenticator
            return code
        raise ValidationError('Invalid code')
