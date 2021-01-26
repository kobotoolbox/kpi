# coding: utf-8
import os
import re
from collections import OrderedDict

from django.utils.translation import gettext as _
from formpack import FormPack
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import (
    ASSET_TYPE_SURVEY
)
from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
)
from kpi.models import Asset, AssetFile, PairedData


class PairedDataSerializer(serializers.Serializer):

    parent = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        queryset=Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY),
        view_name='asset-detail',
        required=True,
    )
    fields = serializers.ListField(child=serializers.CharField())
    filename = serializers.CharField()

    def create(self, validated_data):
        return self.__save(validated_data)

    def __get_download_url(self, instance: 'kpi.models.PairedData') -> str:
        request = self.context['request']
        asset_uid = instance.asset.uid
        paired_data_uid = instance.paired_data_uid
        return reverse(
            'paired-data-detail',
            args=[asset_uid, paired_data_uid],
            request=request,
        )

    def __get_parent_asset_url(self, instance: 'kpi.models.PairedData') -> str:
        request = self.context['request']
        return reverse('asset-detail',
                       args=[instance.parent_uid],
                       request=request)

    def __save(self, validated_data):
        asset = self.context['asset']
        parent = validated_data.pop('parent', None)
        if not self.instance:
            self.instance = PairedData(
                parent_uid=parent.uid,
                asset=asset,
                **validated_data
            )
        else:
            self.instance.update(validated_data)

        self.instance.save()
        return self.instance

    def to_representation(self, instance):
        return {
            'parent': self.__get_parent_asset_url(instance),
            'fields': instance.fields,
            'filename': instance.filename,
            'url': self.__get_download_url(instance),
        }

    def validate(self, attrs: dict) -> dict:
        # Ensure `parent` has been validated before validating `filename`
        # and `fields`. If 'parent' is not present in `attrs`, it should be
        # only on update. (`RelativePrefixHyperlinkedRelatedField` validator
        # enforces its requirement)
        try:
            attrs['parent']
        except KeyError:
            attrs['parent'] = Asset.objects.get(uid=self.instance.parent_uid)

        self._validate_filename(attrs)
        self._validate_fields(attrs)
        return attrs

    def _validate_fields(self, attrs: dict):

        if self.instance and 'fields' not in attrs:
            return

        parent = attrs['parent']
        schema = parent.latest_deployed_version.to_formpack_schema()
        form_pack = FormPack(versions=schema)
        valid_fields = [
            f.name for f in form_pack.get_fields_for_versions()
        ]

        parent_fields = parent.data_sharing.get('fields') or valid_fields
        posted_fields = attrs['fields']
        unknown_fields = set(posted_fields) - set(parent_fields)

        if unknown_fields and parent_fields:
            raise serializers.ValidationError(
                {
                    'fields': _(
                        'Some fields are invalid, '
                        'choices are: `{parent_fields}`'
                    ).format(parent_fields='`,`'.join(parent_fields))
                }
            )

        attrs['fields'] = posted_fields

    def _validate_filename(self, attrs: dict):

        if self.instance and 'filename' not in attrs:
            return

        asset = self.context['asset']
        parent = attrs['parent']
        filename, extension = os.path.splitext(attrs['filename'])

        if (
            not re.match(r'^[\w\d-]+$', filename)
            or (extension.lower() != '.xml' and extension != '')
        ):
            raise serializers.ValidationError(
                {
                    'filename': _('Only letters, numbers and `-` are allowed')
                }
            )

        # force XML extension
        filename = f'{filename}.xml'

        # Validate uniqueness of `filename`
        # It cannot be used by any other asset files
        media_filenames = (
            AssetFile.objects.values_list('metadata__filename', flat=True)
            .filter(asset_id=asset.pk)
            .exclude(file_type=AssetFile.PAIRED_DATA)
        )

        paired_data_filenames = {}
        for p_uid, values in asset.paired_data.items():
            paired_data_filenames[p_uid] = values['filename']

        pd_filename = paired_data_filenames.get(parent.uid)
        is_new = pd_filename is None

        if (
            filename in media_filenames
            or (
                filename in paired_data_filenames.values()
                and (is_new or not is_new and pd_filename != filename)
            )
        ):
            raise serializers.ValidationError(
                {
                    'filename': _(
                        '`{filename}` is already used, filename must be unique'
                    ).format(filename=filename)
                }
            )

        attrs['filename'] = filename

    def validate_parent(self, parent):
        asset = self.context['asset']
        allowed_users = parent.data_sharing.get('users', [])

        if self.instance and self.instance.parent_uid != parent.uid:
            raise serializers.ValidationError(_(
                'Parent cannot be changed'
            ).format(parent_uid=parent.uid))

        # Parent data sharing must be enabled before going further
        if not parent.data_sharing.get('enabled'):
            raise serializers.ValidationError(_(
                'Data sharing for `{parent_uid}` is not enabled'
            ).format(parent_uid=parent.uid))

        # Validate whether owner of the asset is allowed to link their form
        # with the parent. Validation is made with owner of the asset instead of
        # `request.user`
        if (
            allowed_users
            and asset.owner.username not in allowed_users
            and parent.owner != asset.owner
        ):
            raise serializers.ValidationError(_(
                'Pairing data with `{parent_uid}` is not allowed'
            ).format(parent_uid=parent.uid))

        if not self.instance and parent.uid in asset.paired_data:
            raise serializers.ValidationError(_(
                'Parent `{parent_uid}` is already paired'
            ).format(parent_uid=parent.uid))

        return parent

    def update(self, instance, validated_data):
        return self.__save(validated_data)
