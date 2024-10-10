# coding: utf-8
from rest_framework import viewsets
from rest_framework import mixins

from kpi.utils.log import logging


class NoUpdateModelViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet
):
    """
    Inherit from everything that ModelViewSet does, except for
    UpdateModelMixin.
    """
    pass

def get_nested_field(obj, field: str):
    split = field.split('.')
    attribute = getattr(obj, split[0])
    if len(split) > 1:
        for inner_field in split[1:]:
            if isinstance(attribute, dict):
                attribute = attribute.get(inner_field, {})
            else:
                attribute = getattr(attribute, inner_field, {})
    return attribute


class LogThingsViewSet(viewsets.GenericViewSet):
    def get_object(self):
        obj = self.fancy_get_object()
        if self.request.method in ['GET','HEAD']:
            return obj
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            value = get_nested_field(obj, field)
            audit_log_data[field] = value
        self.request._request.audit_log_data_initial = audit_log_data
        return obj

    def perform_update(self, serializer):
        self.fancy_perform_update(serializer)
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            value = get_nested_field(serializer.instance, field)
            audit_log_data[field] = value
        self.request._request.audit_log_data = audit_log_data

    def perform_create(self, serializer):
        self.fancy_perform_create(serializer)
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            value = get_nested_field(serializer.instance, field)
            audit_log_data[field] = value
        self.request._request.audit_log_data = audit_log_data

    def fancy_perform_create(self, serializer):
        super().perform_create(serializer)

    def fancy_perform_update(self, serializer):
        super().perform_update(serializer)

    def fancy_get_object(self):
        return super().get_object()

    def get_fields_we_care_about(self):
        return []

class LogThingsModelViewSet(LogThingsViewSet, viewsets.ModelViewSet):
    pass

class LogThingsNoUpdateModelViewSet(LogThingsModelViewSet,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin):
    pass
