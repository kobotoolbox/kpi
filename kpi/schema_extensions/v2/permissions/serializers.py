from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import CodenameField, ContradictoryField, ImpliedField, NameField, UrlField

PermissionResponse = inline_serializer_class(
    name='PermissionResponse',
    fields={
        'url': UrlField(lookup_field='codename', view_name='permission-detail'),
        'codename': CodenameField(),
        'implied': ImpliedField(),
        'contradictory': ContradictoryField(),
        'name': NameField(),
    },
)
