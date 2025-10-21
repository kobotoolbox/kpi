# coding: utf-8
from rest_framework import serializers
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
