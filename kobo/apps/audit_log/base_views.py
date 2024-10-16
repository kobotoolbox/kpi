from rest_framework import mixins, viewsets


def get_nested_field(obj, field: str):
    """
    Retrieve a period-separated nested field from an object or dict

    Raises an exception if the field is not found
    """
    split = field.split('.')
    attribute = getattr(obj, split[0])
    if len(split) > 1:
        for inner_field in split[1:]:
            if isinstance(attribute, dict):
                attribute = attribute.get(inner_field)
            else:
                attribute = getattr(attribute, inner_field)
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

    def get_object(self):
        # actually fetch the object
        obj = self.get_object_override()
        if self.request.method in ['GET', 'HEAD']:
            # since this is for audit logs, don't worry about read-only requests
            return obj
        audit_log_data = {}
        for field in self.logged_fields:
            value = get_nested_field(obj, field)
            audit_log_data[field] = value
        self.request._request.initial_data = audit_log_data
        return obj

    def perform_update(self, serializer):
        self.perform_update_override(serializer)
        audit_log_data = {}
        for field in self.logged_fields:
            value = get_nested_field(serializer.instance, field)
            audit_log_data[field] = value
        self.request._request.updated_data = audit_log_data

    def perform_create(self, serializer):
        self.perform_create_override(serializer)
        audit_log_data = {}
        for field in self.logged_fields:
            value = get_nested_field(serializer.instance, field)
            audit_log_data[field] = value
        self.request._request.updated_data = audit_log_data

    def perform_destroy(self, instance):
        audit_log_data = {}
        for field in self.logged_fields:
            value = get_nested_field(instance, field)
            audit_log_data[field] = value
        self.request._request.initial_data = audit_log_data
        self.perform_destroy_override(instance)

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
