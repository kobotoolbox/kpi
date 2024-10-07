# coding: utf-8
import json
import os

from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.permissions import get_object_users_with_permissions
from kobo.apps.openrosa.libs.serializers.fields.boolean_field import BooleanField
from kobo.apps.openrosa.libs.serializers.metadata_serializer import MetaDataSerializer
from kobo.apps.openrosa.libs.serializers.tag_list_serializer import TagListSerializer
from kobo.apps.openrosa.libs.utils.decorators import check_obj


class XFormSerializer(serializers.HyperlinkedModelSerializer):

    formid = serializers.ReadOnlyField(source='id')
    metadata = serializers.SerializerMethodField('get_xform_metadata')
    owner = serializers.ReadOnlyField(source='user.username')
    public = BooleanField(source='shared')
    public_data = BooleanField(source='shared_data')
    require_auth = BooleanField()
    tags = TagListSerializer(read_only=True)
    title = serializers.CharField(max_length=255)
    url = serializers.HyperlinkedIdentityField(view_name='xform-detail',
                                               lookup_field='pk')
    users = serializers.SerializerMethodField('get_xform_permissions')
    hash = serializers.SerializerMethodField()

    class Meta:
        model = XForm

        read_only_fields = (
            'json',
            'xml',
            'date_created',
            'date_modified',
            'encrypted',
            'last_submission_time'
        )

        exclude = (
            'json',
            'xml',
            'xls',
            'user',
            'has_start_time',
            'shared',
            'shared_data',
            'pending_delete',
        )

    @check_obj
    def get_hash(self, obj):
        return 'md5:%s' % obj.md5_hash

    # Tests are expecting this `public` to be passed only "True" or "False"
    # and as a string. I don't know how it worked pre-migrations to django 1.8
    # but now it must be implemented manually.
    # As of 2020-03-16, does not seem to be true anymore. `shared` is a boolean
    def validate(self, attrs):
        shared = attrs.get('shared')
        if shared not in (None, True, False, 'True', 'False'):
            raise serializers.ValidationError({
                'shared': "'{}' value must be either True or False.".format(shared)
            })
        attrs['shared'] = shared is True or shared == 'True'
        return attrs

    # Again, this is to match unit tests
    @property
    def data(self):
        data = super().data

        # want to ensure `num_of_submissions` and `attachment_storage_bytes`
        # exist in the data and are integers
        if not data.get('num_of_submissions'):
            data['num_of_submissions'] = 0

        if not data.get('attachment_storage_bytes'):
            data['attachment_storage_bytes'] = 0
        return data

    def get_xform_permissions(self, obj):
        return get_object_users_with_permissions(obj, serializable=True)

    def get_xform_metadata(self, obj):
        if obj:
            return MetaDataSerializer(obj.metadata_set.all(),
                                      many=True, context=self.context).data

        return []


class XFormListSerializer(serializers.Serializer):

    formID = serializers.ReadOnlyField(source='id_string')
    name = serializers.ReadOnlyField(source='title')
    majorMinorVersion = serializers.SerializerMethodField('get_version')
    version = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    descriptionText = serializers.ReadOnlyField(source='description')
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

    def get_version(self, obj):
        # Returns version data
        # The data returned may vary depending on the contents of the
        # version field in the settings of the XLS file when the asset was
        # created or updated
        obj_json = json.loads(obj.json)
        return obj_json.get('version')

    @check_obj
    def get_hash(self, obj):
        return f'md5:{obj.md5_hash_with_disclaimer}'

    @check_obj
    def get_url(self, obj):
        kwargs = {'pk': obj.pk}
        if not self._require_auth:
            kwargs['username'] = obj.user.username

        request = self.context.get('request')

        return reverse('download_xform', kwargs=kwargs, request=request)

    @check_obj
    def get_manifest_url(self, obj):
        kwargs = {'pk': obj.pk}
        if not self._require_auth:
            kwargs['username'] = obj.user.username
        request = self.context.get('request')

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
        kwargs = {'pk': obj.xform.pk, 'metadata': obj.pk}
        if not self._require_auth:
            kwargs['username'] = obj.xform.user.username

        request = self.context.get('request')
        _, extension = os.path.splitext(obj.filename)
        # if `obj` is a remote url, it is possible it does not have any
        # extensions. Thus, only force format when extension exists.
        if extension:
            kwargs['format'] = extension[1:].lower()

        return reverse('xform-media', kwargs=kwargs, request=request)

    @check_obj
    def get_hash(self, obj):
        return '%s' % (obj.md5_hash or 'md5:')
