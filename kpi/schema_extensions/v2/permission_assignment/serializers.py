from django.contrib.auth.models import Permission
from kobo.apps.kobo_auth.shortcuts import User

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    LabelField,
    PartialPermissionField,
    PermissionField,
    UrlField,
    UserField,
)

PermissionResponse = inline_serializer_class(
    name='PermissionResponse',
    fields={
        'url': UrlField(),
        'user': UserField(
            view_name='asset-detail',
            lookup_field='username',
            queryset=User.objects.all(),
            style={'base_template': 'input.html'},
        ),
        'permission': PermissionField(
            view_name='permission-detail',
            lookup_field='codename',
            queryset=Permission.objects.all(),
            style={'base_template': 'input.html'},
        ),
        'label': LabelField(),
    },
)


#
# PermissionCreate = inline_serializer_class(
#     name='PermissionCreate',
#     fields={
#         'url': UrlField(),
#         'user': UserField(),
#         'permission': PermissionField(),
#         'label': LabelField(),
#     },
# )
