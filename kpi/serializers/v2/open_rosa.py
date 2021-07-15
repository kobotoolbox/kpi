# coding: utf-8
from rest_framework import serializers


class FormListSerializer(serializers.Serializer):
    """
    This serializer is model-agnostic. The list of objects passed to the
    serializer must inherit from `kpi.interfaces.open_rosa.OpenRosaFormListInterface`
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
        return obj.description

    def get_download_url(self, obj):
        request = self.context['request']
        return obj.get_download_url(request)

    def get_form_id(self, obj):
        return obj.form_id

    def get_hash(self, obj):
        return obj.md5_hash

    def get_manifest_url(self, obj):
        request = self.context['request']
        return obj.get_manifest_url(request)

    def get_name(self, obj):
        return obj.name


class ManifestSerializer(serializers.Serializer):
    """
    This serializer is model-agnostic.
    The list of objects passed to this serializer must inherit from
    `kpi.interfaces.open_rosa.OpenRosaManifestInterface` to be sure expected
    methods and properties are defined.
    """
    # The PEP-8 naming convention is broken on purpose
    # Open Rosa XML uses CamelCase
    # See https://docs.getodk.org/openrosa-form-list/#the-manifest-document
    filename = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    downloadUrl = serializers.SerializerMethodField('get_download_url')

    def get_download_url(self, obj):
        request = self.context['request']
        return obj.get_download_url(request)

    def get_filename(self, obj):
        return obj.filename

    def get_hash(self, obj):
        return obj.md5_hash

