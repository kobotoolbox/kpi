# coding: utf-8
import json
import os

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.openrosa.libs.utils.decorators import check_obj
from kpi.utils.schema_extensions.fields import ReadOnlyFieldWithSchemaField


class XFormListSerializer(serializers.Serializer):

    formID = ReadOnlyFieldWithSchemaField(
        schema_field=OpenApiTypes.STR, source='id_string'
    )
    name = ReadOnlyFieldWithSchemaField(schema_field=OpenApiTypes.STR, source='title')
    majorMinorVersion = serializers.SerializerMethodField('get_version')
    version = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    descriptionText = ReadOnlyFieldWithSchemaField(
        schema_field=OpenApiTypes.STR, source='description'
    )
    downloadUrl = serializers.SerializerMethodField('get_url')
    manifestUrl = serializers.SerializerMethodField('get_manifest_url')

    def __init__(self, *args, **kwargs):
        self._require_auth = kwargs.pop('require_auth', None)
        super().__init__(*args, **kwargs)

    class Meta:
        fields = '__all__'

        read_only_fields = (
            'formID',
            'name',
            'majorMinorVersion',
            'version',
            'hash',
            'descriptionText',
            'downloadUrl',
            'manifestUrl',
        )

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_version(self, obj):
        # Returns version data
        # The data returned may vary depending on the contents of the
        # version field in the settings of the XLS file when the asset was
        # created or updated
        obj_json = json.loads(obj.json)
        return obj_json.get('version')

    @extend_schema_field(OpenApiTypes.STR)
    @check_obj
    def get_hash(self, obj):
        return f'md5:{obj.md5_hash_with_disclaimer}'

    @extend_schema_field(OpenApiTypes.URI)
    @check_obj
    def get_url(self, obj):
        kwargs = {'pk': obj.pk}
        request = self.context.get('request')
        token = request.parser_context.get('kwargs', {}).get('token', None)
        if token:
            kwargs['token'] = token
        elif not self._require_auth:
            kwargs['username'] = obj.user.username

        return reverse('download_xform', kwargs=kwargs, request=request)

    @extend_schema_field(OpenApiTypes.URI)
    @check_obj
    def get_manifest_url(self, obj):
        request = self.context.get('request')
        kwargs = {'pk': obj.pk}
        token = request.parser_context.get('kwargs', {}).get('token', None)
        if token:
            kwargs['token'] = token
        elif not self._require_auth:
            kwargs['username'] = obj.user.username

        return reverse('manifest-url', kwargs=kwargs, request=request)


class XFormManifestSerializer(serializers.Serializer):

    filename = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    downloadUrl = serializers.SerializerMethodField('get_url')

    def __init__(self, *args, **kwargs):
        self._require_auth = kwargs.pop('require_auth', None)
        super().__init__(*args, **kwargs)

    def get_filename(self, obj):
        # If file has been synchronized from KPI, and it is a remote URL,
        # manifest.xml should return only the name, not the full URL.
        # See https://github.com/kobotoolbox/kobocat/issues/344
        if obj.from_kpi:
            return obj.filename

        # To be retro-compatible, return `data_value` if file has been
        # uploaded from KC directly
        return obj.data_value

    @check_obj
    def get_url(self, obj):
        request = self.context.get('request')
        kwargs = {'pk': obj.xform.pk, 'metadata': obj.pk}
        token = request.parser_context.get('kwargs', {}).get('token', None)
        if token:
            kwargs['token'] = token
        elif not self._require_auth:
            kwargs['username'] = obj.xform.user.username

        _, extension = os.path.splitext(obj.filename)
        # if `obj` is a remote url, it is possible it does not have any
        # extensions. Thus, only force format when extension exists.
        if extension:
            kwargs['format'] = extension[1:].lower()

        return reverse('xform-media', kwargs=kwargs, request=request)

    @check_obj
    def get_hash(self, obj):
        return '%s' % (obj.md5_hash or 'md5:')
