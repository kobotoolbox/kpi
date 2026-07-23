# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.models import AssetVersion
from kpi.schema_extensions.v2.versions.fields import (
    ContentField,
    ContentHashField,
    DateDeployedField,
    DateModifiedField,
    UidField,
    UrlField,
    VersionNumberField,
)


class AssetVersionListSerializer(serializers.Serializer):
    # If you change these fields, please update the `only()` and
    # `select_related()` calls  in `AssetVersionViewSet.get_queryset()`
    uid = UidField()
    url = UrlField()
    content_hash = ContentHashField()
    date_deployed = DateDeployedField(read_only=True)
    date_modified = DateModifiedField()
    version_number = VersionNumberField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Per-request memo of each asset's full-history label map, filled lazily
        # by `get_version_number`. Always a single asset in practice, but keyed
        # by `asset_id` to stay correct regardless
        self._version_labels = {}

    def get_date_deployed(self, obj):
        return obj.deployed and obj.date_modified

    @classmethod
    def _labels_for_asset(cls, asset_id):
        """
        Build `{version_id: "1.2"}` for every version of the asset, in a single
        query and one ordered pass over its full history

        Deployed versions get a major number, e.g. "12": the 1st deployment
        (chronologically) is "1", the 12th is "12". Undeployed versions get a
        minor number appended to the major of the most recent deployment before
        them, e.g. "11.4" is the 4th form change after the 11th deployment;
        drafts made before any deployment use major "0" (e.g. "0.1").

        Versions are ordered by `(date_modified, id)`, so the walk is total and
        deterministic even when timestamps are tied - a draft ordered before a
        same-timestamp deployment is numbered before the major increments.
        """
        rows = (
            AssetVersion.objects.filter(asset_id=asset_id)
            .order_by('date_modified', 'id')
            .values_list('id', 'deployed')
        )
        labels = {}
        major = minor = 0
        for version_id, deployed in rows:
            if deployed:
                major += 1
                minor = 0
                labels[version_id] = str(major)
            else:
                minor += 1
                labels[version_id] = f'{major}.{minor}'
        return labels

    def get_version_number(self, obj):
        """
        Human-readable version number (see `_labels_for_asset`), consistent
        across pages, `?deployed=` filters, and the `retrieve` action

        The full-history label map is computed once per serializer instance and
        memoized per asset (see `__init__`), so serializing a whole page costs
        one extra query, not one per row. The lookup is keyed on `id`.
        """
        if obj.asset_id not in self._version_labels:
            self._version_labels[obj.asset_id] = self._labels_for_asset(
                obj.asset_id
            )
        return self._version_labels[obj.asset_id][obj.id]

    def get_url(self, obj):
        return reverse(
            'asset-version-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )


class AssetVersionSerializer(AssetVersionListSerializer):
    content = ContentField(read_only=True)

    def get_content(self, obj):
        return obj.version_content

    def get_version_id(self, obj):
        return obj.uid

    class Meta:
        model = AssetVersion
        fields = (
                    'version_id',
                    'date_deployed',
                    'date_modified',
                    'content_hash',
                    'content',
                  )
