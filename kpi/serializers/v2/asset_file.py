# coding: utf-8
import base64
import json
import os
from mimetypes import guess_type

from django.core.files.base import ContentFile
from django.utils.translation import ugettext as _
from django.utils.translation import ugettext_lazy as _lazy
from rest_framework import serializers
from rest_framework.reverse import reverse


from kpi.fields import RelativePrefixHyperlinkedRelatedField, \
    SerializerMethodFileField, WritableJSONField
from kpi.models.asset_file import AssetFile


class AssetFileSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    asset = RelativePrefixHyperlinkedRelatedField(
        view_name='asset-detail', lookup_field='uid', read_only=True)
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail', lookup_field='username', read_only=True)
    user__username = serializers.ReadOnlyField(source='user.username')
    file_type = serializers.ChoiceField(choices=AssetFile.TYPE_CHOICES)
    description = serializers.CharField()
    date_created = serializers.ReadOnlyField()
    content = SerializerMethodFileField()
    metadata = WritableJSONField(required=False)

    def get_url(self, obj):
        return reverse('asset-file-detail',
                       args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))

    def get_content(self, obj, *args, **kwargs):
        return reverse('asset-file-content',
                       args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))

    class Meta:
        model = AssetFile
        fields = (
            'uid',
            'url',
            'asset',
            'user',
            'user__username',
            'file_type',
            'description',
            'date_created',
            'content',
            'metadata',
        )

    def validate_empty_values(self, data):
        self._populate_content(data)
        return super().validate_empty_values(data)

    def validate(self, data):

        file_type = data['file_type']

        if file_type == AssetFile.FORM_MEDIA:
            view = self.context.get('view')
            asset = getattr(view, 'asset', self.context.get('asset'))
            content = data['content']
            path = AssetFile.get_path(asset, file_type, content.name)
            if AssetFile.objects.filter(content=path).exists():
                raise serializers.ValidationError({
                    'filename': _('`{}` already exists').format(content.name)
                })

        return data

    def _populate_content(self, data):
        """
        File can be either a binary content or a base64 encoded string
        (through `base64Encoded` `POST` param).
        If `content` already exists, nothing happens.
        If `content` is empty, it's populated with `base64Encoded` if
        it exists and is valid (some validations are made within this method).
        """

        # Test if binary file has been uploaded. If it is the case,
        # do not go further.
        try:
            data['content']
        except KeyError:
            pass
        else:
            return data

        metadata = self._validate_metadata(data.get('metadata'))

        # Ensure that all fields are present. Otherwise, let's other validators
        # raise errors
        try:
            base64_encoded = data['base64Encoded']
            file_type = data['file_type']
        except KeyError:
            return data

        # Check if content type is allowed
        try:
            allowed_content_types = AssetFile.ALLOWED_CONTENT_TYPES[file_type]
        except KeyError:
            pass
        else:
            mime_type, _ = guess_type(base64_encoded)
            if not mime_type.startswith(allowed_content_types):
                allowed_content_types_csv = '`, `'.join(allowed_content_types)
                message = f'Only `{allowed_content_types_csv}` mimetypes are allowed'
                raise serializers.ValidationError({
                    'base64Encoded': _lazy(message)
                })

        # Check if extension is allowed
        try:
            allowed_extensions = AssetFile.ALLOWED_EXTENSIONS[file_type]
        except KeyError:
            pass
        else:
            basename, file_extension = os.path.splitext(metadata['filename'])
            if file_extension not in allowed_extensions:
                allowed_extensions_csv = '`, `'.join(allowed_extensions)
                message = f'Only `{allowed_extensions_csv}` extensions are allowed'
                raise serializers.ValidationError({
                    'base64Encoded': _lazy(message)
                })

        # Populate `content` with base64 content
        try:
            media_content = base64_encoded[base64_encoded.index('base64') + 7:]
        except ValueError:
            raise serializers.ValidationError({
                'base64Encoded': _('Invalid content')
            })

        data.update({
            'content': ContentFile(base64.decodebytes(media_content.encode()),
                                   name=metadata['filename'])
        })

        return data

    def _validate_metadata(self, metadata):
        if not metadata:
            raise serializers.ValidationError({
                'metadata': _('This field is required')
            })

        try:
            metadata = json.loads(metadata)
        except ValueError:
            raise serializers.ValidationError({
                'metadata': _('JSON is invalid')
            })

        try:
            metadata['filename']
        except KeyError:
            raise serializers.ValidationError({
                'metadata': _('`filename` is required')
            })

        return metadata

