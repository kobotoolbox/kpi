# coding: utf-8
from django.contrib.auth.models import User
from rest_framework import serializers

from kpi.models import OneTimeAuthenticationKey


class OneTimeAuthenticationKeySerializer(serializers.ModelSerializer):
    username = serializers.SlugRelatedField(
        slug_field='username', source='user', queryset=User.objects.all())

    class Meta:
        model = OneTimeAuthenticationKey
        fields = ('username', 'key', 'expiry')
