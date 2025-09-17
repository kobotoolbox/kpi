from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ExtraDetailField,
    GitRevField,
    GravatarField,
    OrganizationField,
    ProjectUrlField,
    SocialAccountField,
)

CurrentUserDeleteRequest = inline_serializer_class(
    name='CurrentUserDeleteRequest',
    fields={
        'confirm': serializers.CharField(),
    },
)

MeListResponse = inline_serializer_class(
    name='MeListResponse',
    fields={
        'username': serializers.CharField(),
        'first_name': serializers.CharField(),
        'last_name': serializers.CharField(),
        'email': serializers.EmailField(),
        'server_time': serializers.DateTimeField(),
        'date_joined': serializers.DateTimeField(),
        'projects_url': ProjectUrlField(),
        'gravatar': GravatarField(),
        'last_login': serializers.DateTimeField(),
        'extra_details': ExtraDetailField(),
        'git_rev': GitRevField(),
        'social_accounts': SocialAccountField(),
        'validated_password': serializers.BooleanField(),
        'accepted_tos': serializers.BooleanField(),
        'organization': OrganizationField(),
        'extra_details__uid': serializers.CharField(),
    },
)
