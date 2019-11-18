# coding: utf-8
from urllib.parse import urlparse

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ObjectDoesNotExist
from django.urls import (
    Resolver404,
    get_script_prefix,
    resolve,
)
from rest_framework import serializers

from kpi.models.object_permission import ObjectPermission


class GenericHyperlinkedRelatedField(serializers.HyperlinkedRelatedField):

    def __init__(self, **kwargs):
        # These arguments are required by ancestors but meaningless in our
        # situation. We will override them dynamically.
        kwargs['view_name'] = '*'
        kwargs['queryset'] = ObjectPermission.objects.none()
        super().__init__(**kwargs)

    def to_representation(self, value):
        # TODO Figure out why self.view_name is initialized twice in a row?
        self.view_name = '{}-detail'.format(
            ContentType.objects.get_for_model(value).model)
        result = super().to_representation(value)
        self.view_name = '*'
        return result

    def to_internal_value(self, data):
        """ The vast majority of this method has been copied and pasted from
        HyperlinkedRelatedField.to_internal_value(). Modifications exist
        to allow any type of object. """
        _ = self.context.get('request', None)
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        # The script prefix must be removed even if the URL is relative.
        # TODO: Figure out why DRF only strips absolute URLs, or file bug
        if True or http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        try:
            match = resolve(data)
        except Resolver404:
            self.fail('no_match')

        # ## Begin modifications ###
        # We're a generic relation; we don't discriminate
        """
        try:
            expected_viewname = request.versioning_scheme.get_versioned_viewname(
                self.view_name, request
            )
        except AttributeError:
            expected_viewname = self.view_name

        if match.view_name != expected_viewname:
            self.fail('incorrect_match')
        """

        # Dynamically modify the queryset
        self.queryset = match.func.cls.queryset
        # ## End modifications ###

        try:
            return self.get_object(match.view_name, match.args, match.kwargs)
        except (ObjectDoesNotExist, TypeError, ValueError):
            self.fail('does_not_exist')
