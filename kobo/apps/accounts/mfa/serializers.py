# coding: utf-8
from rest_framework import serializers
from trench.utils import get_mfa_model


class UserMfaMethodSerializer(serializers.ModelSerializer):
    """
    Exposes user's MFA methods, per-user availability, and their created, modified and disabled dates
    """
    mfa_available = serializers.BooleanField()

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
