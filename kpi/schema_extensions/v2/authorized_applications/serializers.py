from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


AuthenticatePayload = inline_serializer(
    name='AuthenticatePayload',
    fields={
        'username': serializers.CharField(),
        'password': serializers.CharField(),
    },
)


AuthenticateResponse = inline_serializer(
    name='AuthenticateResponse',
    fields={
        'token': serializers.CharField(),
        'username': serializers.CharField(),
        'first_name': serializers.CharField(),
        'last_name': serializers.CharField(),
        'email': serializers.EmailField(),
        'is_staff': serializers.BooleanField(),
        'is_active': serializers.BooleanField(),
        'is_superuser': serializers.BooleanField(),
        'last_login': serializers.DateTimeField(),
        'date_joined': serializers.DateTimeField(),
    },
)
