# coding: utf-8
import mimetypes
import os
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.validators import URLValidator
from django.utils.translation import gettext as t
from rest_framework import serializers
from werkzeug.http import parse_options_header

from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.constants import CAN_CHANGE_XFORM, CAN_VIEW_XFORM

METADATA_TYPES = (
    ('data_license', t("Data License")),
    ('form_license', t("Form License")),
    ('media', t("Media")),
    ('public_link', t("Public Link")),
    ('source', t("Source")),
    ('supporting_doc', t("Supporting Document")),
    ('paired_data', t("Paired Data")),
)


class MetaDataSerializer(serializers.HyperlinkedModelSerializer):
    id = serializers.IntegerField(source='pk', read_only=True)
    xform = serializers.PrimaryKeyRelatedField(queryset=XForm.objects.all())
    data_value = serializers.CharField(max_length=255,
                                       required=False)
    data_type = serializers.ChoiceField(choices=METADATA_TYPES)
    data_file = serializers.FileField(required=False)
    from_kpi = serializers.BooleanField(required=False)
    data_filename = serializers.CharField(max_length=255, required=False)

    class Meta:
        model = MetaData
        fields = (
            'id',
            'xform',
            'data_value',
            'data_type',
            'data_file',
            'data_file_type',
            'file_hash',
            'url',
            'from_kpi',
            'data_filename',
        )
        read_only_fields = (
            'id',
            'data_file_type',
        )

    # was previously validate_data_value but the signature change in DRF3.
    def validate(self, attrs):
        """
        Ensure we have a valid url if we are adding a media uri
        instead of a media file
        """
        self._validate_data_value(attrs)
        self._validate_data_file_type(attrs)

        return super().validate(attrs)

    def validate_xform(self, xform):
        request = self.context.get('request')

        if not request.user.has_perm(CAN_VIEW_XFORM, xform):
            raise serializers.ValidationError(t('Project not found'))

        if not request.user.has_perm(CAN_CHANGE_XFORM, xform):
            raise serializers.ValidationError(t(
                'You do not have sufficient permissions to perform this action'
            ))

        return xform

    def create(self, validated_data):
        data_type = validated_data.get('data_type')
        data_file = validated_data.get('data_file')
        data_file_type = validated_data.get('data_file_type')
        from_kpi = validated_data.get('from_kpi', False)
        xform = validated_data.get('xform')
        file_hash = validated_data.get('file_hash')
        data_value = (
            data_file.name if data_file else validated_data.get('data_value')
        )
        data_filename = validated_data.get('data_filename')

        return MetaData.objects.create(
            data_type=data_type,
            xform=xform,
            data_value=data_value,
            data_file=data_file,
            data_file_type=data_file_type,
            file_hash=file_hash,
            from_kpi=from_kpi,
            data_filename=data_filename,
        )

    def _validate_data_value(self, attrs):
        if self.instance and self.instance.pk:
            # ToDo , Should we allow PATCHing the object with different file?
            attrs['data_file'] = attrs.get(
                'data_file', self.instance.data_file
            )
            attrs['data_type'] = attrs.get(
                'data_type', self.instance.data_type
            )
            try:
                attrs['data_value']
            except KeyError:
                attrs['data_value'] = self.instance.data_value
                return attrs

        data_value = attrs.get('data_value')

        if attrs.get('data_type') == 'media' and attrs.get('data_file') is None:
            message = {'data_value': t('Invalid url {}').format(data_value)}
            URLValidator(message=message)(data_value)

        if not data_value:
            raise serializers.ValidationError(
                {'data_value': t('This field is required.')}
            )

        return attrs

    def _validate_data_file_type(self, attrs):

        allowed_types = settings.SUPPORTED_MEDIA_UPLOAD_TYPES

        data_file = attrs.get('data_file')  # This is could be `None`
        data_value = attrs['data_value']

        if data_value.lower().startswith('http'):
            # If `data_value` is a URL but we cannot get the filename from it,
            # let's try from the headers
            parsed_url = urlparse(data_value)
            filename, extension = os.path.splitext(
                os.path.basename(parsed_url.path)
            )
            if not extension:
                try:
                    # `stream=True` makes `requests` to not download the whole
                    # file until `response.content` is called.
                    # Useful to get 'Content-Disposition' header.
                    response = requests.get(data_value, stream=True)
                    response.raise_for_status()
                except requests.exceptions.RequestException:
                    response.close()
                    raise serializers.ValidationError({
                        {'data_file_type': t('Cannot determine content type')}
                    })
                else:
                    response.close()

                try:
                    filename_from_header = parse_options_header(
                        response.headers['Content-Disposition']
                    )
                except KeyError:
                    raise serializers.ValidationError({
                        {'data_file_type': t('Cannot determine content type')}
                    })

                try:
                    data_value = filename_from_header[1]['filename']
                except (TypeError, IndexError, KeyError):
                    raise serializers.ValidationError({
                        {'data_file_type': t('Cannot determine content type')}
                    })
            else:
                # In case the url contains a querystring, let's rebuild the
                # `data_value` within this scope to detect its mimetype
                data_value = f'{filename}{extension}'

        # Used to rely on `data_file.content_type`. Unfortunately, when object
        # is PATCHed, `data_file` is not a `InMemoryUploadedFile` object anymore
        # but a `FieldFile` object which doesn't have a `content_type` attribute
        filename = data_file.name if data_file else data_value
        attrs['data_file_type'] = mimetypes.guess_type(filename)[0]

        if attrs['data_file_type'] not in allowed_types:
            raise serializers.ValidationError(
                {'data_file_type': t('Invalid content type')}
            )

        return attrs
