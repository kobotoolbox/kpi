# coding: utf-8
from rest_framework import serializers

from kpi.models.open_rosa import (
    AbstractOpenRosaFormListModel,
    AbstractOpenRosaManifestModel,
)


class FormListSerializer(serializers.Serializer):
    """
    This serializer is model-agnostic. The list of objects passed to the
    serializer must inherit from `kpi.models.open_rosa.AbstractOpenRosaFormListModel`
    to be sure expected methods and properties are defined.
    """
    # The PEP-8 naming convention is broken on purpose
    # Open Rosa XML uses CamelCase
    # See https://docs.getodk.org/openrosa-form-list/#successful-response-document
    formID = serializers.SerializerMethodField('get_form_id')
    name = serializers.SerializerMethodField('get_name')
    hash = serializers.SerializerMethodField('get_name')
    descriptionText = serializers.SerializerMethodField('get_description')
    downloadUrl = serializers.SerializerMethodField('get_download_url')
    manifestUrl = serializers.SerializerMethodField('get_manifest_url')

    def get_description(self, obj):
        return obj.hash

    def get_download_url(self, obj):
        request = self.context['request']
        return obj.get_download_url(request)

    def get_form_id(self, obj):
        return obj.form_id

    def get_hash(self, obj):
        return obj.hash

    def get_manifest_url(self, obj):
        request = self.context['request']
        return obj.get_manifest_url(request)

    def get_name(self, obj):
        return obj.name

    def __validate_object_inheritance(
        self, obj: AbstractOpenRosaFormListModel
    ) -> bool:
        """
        Validates if object inherits from `AbstractOpenRosaFormListModel`.
        It helps to catch upstream missing properties and methods when
        rendering data
        """
        # Use private variable to test validation only once per instantiation
        if not getattr(self, '__validated', False):
            assert issubclass(obj.__class__, AbstractOpenRosaFormListModel)
            self.__validate = True
        return self.__validate


class ManifestSerializer(serializers.Serializer):
    """
    This serializer is model-agnostic. The list of objects passed to the
    serializer must inherit from `kpi.models.open_rosa.AbstractOpenRosaManifestModel`
    to be sure expected methods and properties are defined.
    """
    # The PEP-8 naming convention is broken on purpose
    # Open Rosa XML uses CamelCase
    # See https://docs.getodk.org/openrosa-form-list/#the-manifest-document
    filename = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    downloadUrl = serializers.SerializerMethodField('get_download_url')  # noqa

    def get_download_url(self, obj):
        self.__validate_object_inheritance(obj)
        request = self.context['request']
        return obj.get_download_url(request)

    def get_filename(self, obj):
        self.__validate_object_inheritance(obj)
        return obj.filename

    def get_hash(self, obj):
        self.__validate_object_inheritance(obj)
        return obj.hash

    def __validate_object_inheritance(
        self, obj: AbstractOpenRosaManifestModel
    ) -> bool:
        """
        Validates if object inherits from `AbstractOpenRosaFormListModel`.
        It helps to catch upstream missing properties and methods when 
        rendering data
        """
        # Use private variable to test validation only once per instantiation
        if not getattr(self, '__validated', False):
            try:
                assert issubclass(obj.__class__, AbstractOpenRosaManifestModel)
            except AssertionError:
                raise Exception('Object must inherit from '
                                '`AbstractOpenRosaManifestModel`')
            self.__validated = True
        return self.__validated
