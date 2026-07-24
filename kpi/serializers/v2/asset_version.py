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
        # Memo of `{asset_id: {version_id: label}}`, built lazily per asset by
        # `get_version_number`. The asset is taken from `obj`, not the view, so
        # this works both for the versions endpoints and when this serializer is
        # the nested `deployed_versions` field of an asset (whose view is
        # `AssetViewSet`, which has no `asset_uid`). Keyed by `asset_id` so one
        # instance stays correct even if reused across assets
        self._version_labels = {}

    def get_date_deployed(self, obj):
        return obj.deployed and obj.date_modified

    def get_version_number(self, obj):
        """
        Human-readable version number (see `_build_version_labels`), consistent
        across pages, `?deployed=` filters, and the `retrieve` action

        The label map is built once per asset (a single query over its full
        history) and memoized on this serializer instance, so serializing a
        whole page adds one query, not one per row. The lookup is keyed on `id`.
        """
        labels = self._version_labels.get(obj.asset_id)
        if labels is None:
            labels = self._version_labels[obj.asset_id] = (
                self._build_version_labels(obj.asset_id)
            )
        return labels[obj.id]

    def get_url(self, obj):
        return reverse(
            'asset-version-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )

    @classmethod
    def _build_version_labels(cls, asset_id):
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
