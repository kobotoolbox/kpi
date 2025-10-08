# coding: utf-8
import os
import re

from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.reports.constants import FUZZY_VERSION_PATTERN
from kobo.apps.reports.report_data import build_formpack
from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.fields import RelativePrefixHyperlinkedRelatedField
from kpi.models import Asset, AssetFile, PairedData
from kpi.schema_extensions.v2.paired_data.fields import (
    FieldFields,
    SourceNameField,
    URLField,
)


class PairedDataSerializer(serializers.Serializer):

    source = RelativePrefixHyperlinkedRelatedField(
        lookup_field='uid',
        lookup_url_kwarg='uid_asset',
        queryset=Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY),
        view_name='asset-detail',
        required=True,
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    fields = FieldFields(child=serializers.CharField(), required=False)
    filename = serializers.CharField()
    source__name = SourceNameField()

    def create(self, validated_data):
        return self.__save(validated_data)

    def get_source__name(self, paired_data):
        # To avoid multiple calls to DB, try to retrieve source names from
        # the context.
        source__name = None
        try:
            source__name = self.context['source__names'].get(
                paired_data.source_uid
            )
        except KeyError:
            # Fallback on DB query.
            try:
                source__name = Asset.objects.values_list('name', flat=True).get(
                    uid=paired_data.source_uid
                )
            except Asset.DoesNotExist:
                pass
            else:
                source__name = source.name

        return source__name

    def to_representation(self, instance):
        return {
            'source': self.__get_source_asset_url(instance),
            'source__name': self.get_source__name(instance),
            'fields': instance.fields,
            'filename': instance.filename,
            'url': self.__get_download_url(instance),
        }

    def validate(self, attrs: dict) -> dict:
        # Ensure `source`, which is required on creation but not on update, has
        # been validated before validating `filename` and `fields`.
        # (`RelativePrefixHyperlinkedRelatedField` validator enforces this
        # requirement)
        try:
            attrs['source']
        except KeyError:
            attrs['source'] = Asset.objects.get(uid=self.instance.source_uid)

        self._validate_filename(attrs)
        self._validate_fields(attrs)
        return attrs

    def validate_source(self, source):
        asset = self.context['asset']

        if self.instance and self.instance.source_uid != source.uid:
            raise serializers.ValidationError(
                t('Source cannot be changed')
            )

        # Source data sharing must be enabled before going further
        if not source.data_sharing.get('enabled'):
            raise serializers.ValidationError(t(
                'Data sharing for `{source_uid}` is not enabled'
            ).format(source_uid=source.uid))

        # Validate whether owner of the asset is allowed to link their form
        # with the source. Validation is made with owner of the asset instead of
        # `request.user`
        required_perms = [
            PERM_PARTIAL_SUBMISSIONS,
            PERM_VIEW_SUBMISSIONS,
        ]
        if not source.has_perms(asset.owner, required_perms, all_=False):
            raise serializers.ValidationError(t(
                'Pairing data with `{source_uid}` is not allowed'
            ).format(source_uid=source.uid))

        if not self.instance and source.uid in asset.paired_data:
            raise serializers.ValidationError(t(
                'Source `{source}` is already paired'
            ).format(source=source.name))

        return source

    def update(self, instance, validated_data):
        return self.__save(validated_data)

    def _validate_fields(self, attrs: dict):

        if 'fields' not in attrs:
            # if paired data is created and `fields` does not exist in `POST`
            # payload, let's initialize it as an empty list
            if not self.instance:
                attrs['fields'] = []
            return

        source = attrs['source']
        # We used to get all fields for every version for valid fields,
        # but the UI shows the latest version only, so only its fields
        # can be picked up. It is easier then to compare valid fields with
        # user's choice.
        form_pack, _unused = build_formpack(
            source, submission_stream=[], use_all_form_versions=False
        )
        # We do not want to include the version field.
        # See `_infer_version_id()` in `kobo.apps.reports.report_data.build_formpack`
        # for field name alternatives.
        valid_fields = [
            f.path for f in form_pack.get_fields_for_versions(
                form_pack.versions.keys()
            ) if not re.match(FUZZY_VERSION_PATTERN, f.path)
        ]

        source_fields = source.data_sharing.get('fields') or valid_fields
        posted_fields = attrs['fields']
        unknown_fields = set(posted_fields) - set(source_fields)

        if unknown_fields and source_fields:
            raise serializers.ValidationError(
                {
                    'fields': t(
                        'Some fields are invalid, '
                        'choices are: `{source_fields}`'
                    ).format(source_fields='`,`'.join(source_fields))
                }
            )

        # Force `posted_fields` to be an empty list to avoid useless parsing when
        # fetching external xml endpoint (i.e.: /api/v2/assets/<asset_uid>/paired-data/<uid_paired_data>/external.xml)
        if sorted(valid_fields) == sorted(posted_fields):
            posted_fields = []

        attrs['fields'] = posted_fields

    def _validate_filename(self, attrs: dict):

        if self.instance and 'filename' not in attrs:
            return

        asset = self.context['asset']
        source = attrs['source']
        filename, extension = os.path.splitext(attrs['filename'])

        if not re.match(r'^[\w\d-]+$', filename):
            raise serializers.ValidationError(
                {
                    'filename': t('Only letters, numbers and `-` are allowed')
                }
            )

        if extension.lower() != '.xml' and extension != '':
            raise serializers.ValidationError(
                {
                    'filename': t('Extension must be `xml`')
                }
            )

        # force XML extension
        basename = filename
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

        pd_filename = paired_data_filenames.get(source.uid)
        is_new = pd_filename is None

        if (
            filename in media_filenames
            or (
                filename in paired_data_filenames.values()
                and (is_new or (not is_new and pd_filename != filename))
            )
        ):
            raise serializers.ValidationError(
                {
                    'filename': t(
                        '`{basename}` is already used'
                    ).format(basename=basename)
                }
            )

        attrs['filename'] = filename

    @extend_schema_field(URLField)
    def __get_download_url(self, instance: 'kpi.models.PairedData') -> str:
        request = self.context['request']
        asset_uid = instance.asset.uid
        paired_data_uid = instance.paired_data_uid
        return reverse(
            'paired-data-detail',
            args=[asset_uid, paired_data_uid],
            request=request,
        )

    def __get_source_asset_url(self, instance: 'kpi.models.PairedData') -> str:
        request = self.context['request']
        return reverse('asset-detail',
                       args=[instance.source_uid],
                       request=request)

    def __save(self, validated_data):
        asset = self.context['asset']
        source = validated_data.pop('source', None)
        if not self.instance:
            self.instance = PairedData(
                source_asset_or_uid=source.uid,
                asset=asset,
                **validated_data
            )
        else:
            self.instance.update(validated_data)

        self.instance.save()
        return self.instance
