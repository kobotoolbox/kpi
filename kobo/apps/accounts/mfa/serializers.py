from allauth.mfa.totp.internal.auth import TOTP
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from .models import MfaMethodsWrapper


class UserMfaMethodSerializer(serializers.ModelSerializer):
    """
    Exposes user's MFA methods and their created, modified and disabled dates
    """

    class Meta:
        model = MfaMethodsWrapper
        fields = (
            'name',
            'is_active',
            'date_created',
            'date_modified',
            'date_disabled',
        )


class TOTPCodeSerializer(serializers.Serializer):
    """
    Intended to be used for validating TOTP codes
    """
    code = serializers.CharField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = self.context['user']
        self.method = self.context['method']
        try:
            self.mfamethods = MfaMethodsWrapper.objects.get(
                user=self.user, is_active=True, name=self.method
            )
        except MfaMethodsWrapper.DoesNotExist:
            raise NotFound
        self.totp = TOTP(self.mfamethods.totp)

    def validate_code(self, value):
        if not self.totp.validate_code(value):
            raise ValidationError('Invalid TOTP code')

        return value
