# coding: utf-8
from rest_framework import serializers
from trench.serializers import RequestMFAMethodActivationSerializer
from trench.utils import create_secret, get_mfa_model


class ActivateMfaMethodSerializer(RequestMFAMethodActivationSerializer):
    
    def create(self, validated_data):
        """
        When the client requests creation of a new MFA method, *always* create
        a new secret. The default django-trench behavior reuses old secrets,
        meaning that without this override, a given user would always see the
        same QR code no matter how many times they enabled and disabled MFA.
        That default behavior would create a security weakness if a user lost
        their original device, because deactivating MFA and reconfiguring it on
        a new device would not prevent the lost device from continuing to
        generate valid TOTPs.
        """
        mfa_method, created = super().create(validated_data)
        if not created:
            mfa_method.secret = create_secret()
            mfa_method.save()
        return mfa_method, created


class UserMfaMethodSerializer(serializers.ModelSerializer):
    """
    Exposes user's MFA methods and their created, modified and disabled dates
    """
    class Meta:
        model = get_mfa_model()
        fields = (
            'name',
            'is_primary',
            'is_active',
            'date_created',
            'date_modified',
            'date_disabled',
        )
