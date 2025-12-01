from allauth.mfa.base.internal.flows import check_rate_limit
from allauth.mfa.models import Authenticator
from django.contrib.auth.hashers import check_password
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


class MfaCodeSerializer(serializers.Serializer):
    """
    Intended to be used for validating TOTP and recovery codes
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

    def validate_code(self, code):
        clear_rl = check_rate_limit(self.user)
        for auth in [self.mfamethods.totp, self.mfamethods.recovery_codes]:
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

    def validate_migrated_codes(self, input_code, recovery_codes):
        codes = recovery_codes._get_migrated_codes()
        if codes is None:
            return
        if not codes[0].startswith('pbkdf2_sha256$'):
            return
        # if codes are sha256 hashes do the recovery codes logic
        for idx, hashed_code in enumerate(codes):
            if check_password(input_code, hashed_code):
                recovery_codes.validate_code(hashed_code)
                return hashed_code
