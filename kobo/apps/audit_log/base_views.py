from rest_framework import mixins, viewsets

from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


def get_nested_field(obj, field: str):
    """
    Retrieve a period-separated nested field from an object or dict

    Returns None if the field is not found
    """
    split = field.split('.')
    attribute = obj

    for inner_field in split:
        if attribute is None:
            break
        if isinstance(attribute, dict):
            attribute = attribute.get(inner_field, None)
        else:
            attribute = getattr(attribute, inner_field, None)
    return attribute


class AuditLoggedViewSet(viewsets.GenericViewSet):
    """
    A ViewSet for adding arbitrary object data to a request before and after request

    Useful for storing information for audit logs on create/update. Allows inheriting
    ViewSets to implement additional logic for get_object, perform_update,
    perform_create, and perform_destroy via the get_object_override,
    perform_update_override, perform_create_override, and perform_destroy_override
    methods.

    Sets the values on the inner HttpRequest object rather than the DRF Request
    so middleware can access them.
    """

    logged_fields = []

    def initialize_request(self, request, *args, **kwargs):
        request = super().initialize_request(request, *args, **kwargs)
        request._request.log_type = self.log_type
        request._request._data = request.data.copy()
        if isinstance(self, AssetNestedObjectViewsetMixin):
            request._request.asset = self.asset
        return request

    def get_object(self):
        # actually fetch the object
        obj = self.get_object_override()
        if self.request.method in ['GET', 'HEAD']:
            # since this is for audit logs, don't worry about read-only requests
            return obj
        audit_log_data = {}
        for field in self.logged_fields:
            field_path = field[1] if isinstance(field, tuple) else field
            field_label = field[0] if isinstance(field, tuple) else field
            value = get_nested_field(obj, field_path)
            audit_log_data[field_label] = value
        self.request._request.initial_data = audit_log_data
        return obj

    def perform_update(self, serializer):
        self.perform_update_override(serializer)
        audit_log_data = {}
        for field in self.logged_fields:
            field_path = field[1] if isinstance(field, tuple) else field
            field_label = field[0] if isinstance(field, tuple) else field
            value = get_nested_field(serializer.instance, field_path)
            audit_log_data[field_label] = value
        self.request._request.updated_data = audit_log_data

    def perform_create(self, serializer):
        self.perform_create_override(serializer)
        audit_log_data = {}
        for field in self.logged_fields:
            field_path = field[1] if isinstance(field, tuple) else field
            field_label = field[0] if isinstance(field, tuple) else field
            value = get_nested_field(serializer.instance, field_path)
            audit_log_data[field_label] = value
        self.request._request.updated_data = audit_log_data

    def perform_destroy(self, instance):
        audit_log_data = {}
        for field in self.logged_fields:
            field_path = field[1] if isinstance(field, tuple) else field
            field_label = field[0] if isinstance(field, tuple) else field
            value = get_nested_field(instance, field_path)
            audit_log_data[field_label] = value
        self.perform_destroy_override(instance)
        self.request._request.initial_data = audit_log_data

    def perform_destroy_override(self, instance):
        super().perform_destroy(instance)

    def perform_create_override(self, serializer):
        super().perform_create(serializer)

    def perform_update_override(self, serializer):
        super().perform_update(serializer)

    def get_object_override(self):
        return super().get_object()


class AuditLoggedModelViewSet(
    AuditLoggedViewSet,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
):
    pass


class AuditLoggedNoUpdateModelViewSet(
    AuditLoggedModelViewSet,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
):
    pass
