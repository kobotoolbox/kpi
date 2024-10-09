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

class LogThingsViewSet(viewsets.GenericViewSet):
    def get_object(self):
        obj = self.fancy_get_object()
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            split = field.split('.')
            logging.info(f'{split=}')
            thing = getattr(obj, split[0], {})
            if len(split) >= 1:
                for smaller_field in split[1:]:
                    logging.info(f'{smaller_field=}')
                    logging.info(f'{thing=}')
                    thing = thing.get(smaller_field, {}) if isinstance(thing, dict) else getattr(thing, smaller_field, {})
            audit_log_data[field] = thing
        self.request._request.audit_log_data_initial = audit_log_data
        return obj

    def perform_update(self, serializer):
        stuff = self.fancy_perform_update(serializer)
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            audit_log_data[field] = serializer.data.get(field)
        self.request._request.audit_log_data = audit_log_data
        return stuff

    def perform_create(self, serializer):
        self.fancy_perform_create(serializer)
        #logging.info(f'{serializer=}')
        audit_log_data = {}
        for field in self.get_fields_we_care_about():
            split = field.split('.')
            logging.info(f'{split=}')
            logging.info(f'{serializer.data.keys()}')
            thing = serializer.data.get(split[0],{})
            if len(split) >= 1:
                for smaller_field in split[1:]:
                    logging.info(f'{smaller_field=}')
                    logging.info(f'{thing=}')
                    thing = thing.get(smaller_field, {}) if isinstance(thing, dict) else getattr(thing, smaller_field, {})
            audit_log_data[field] = thing
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
