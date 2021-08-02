# coding: utf-8
from rest_framework import serializers

from kpi.fields import PaginatedApiField
from kpi.serializers.v2.asset import AssetSerializer as AssetSerializerV2
from .object_permission import ObjectPermissionNestedSerializer


class AssetSerializer(AssetSerializerV2):

    # Only relevant for collections
    children = PaginatedApiField(
        serializer_class="kpi.serializers.v1.asset.AssetListSerializer"
    )

    class Meta(AssetSerializerV2.Meta):
        fields = ('url',
                  'owner',
                  'owner__username',
                  'parent',
                  'settings',
                  'asset_type',
                  'date_created',
                  'summary',
                  'date_modified',
                  'version_id',
                  'version__content_hash',
                  'version_count',
                  'has_deployment',
                  'deployed_version_id',
                  'deployed_versions',
                  'deployment__identifier',
                  'deployment__links',
                  'deployment__active',
                  'deployment__data_download_links',
                  'deployment__submission_count',
                  'report_styles',
                  'report_custom',
                  'map_styles',
                  'map_custom',
                  'content',
                  'downloads',
                  'embeds',
                  'koboform_link',
                  'xform_link',
                  'hooks_link',
                  'tag_string',
                  'uid',
                  'kind',
                  'xls_link',
                  'name',
                  # 'assignable_permissions', # intentionally omitted
                  'permissions',
                  'settings',
                  'children',
                  )

    permissions = serializers.SerializerMethodField()

    def get_permissions(self, asset):
        # Filter in Python, not with the ORM's `filter()`, to avoid an extra
        # query per asset
        return ObjectPermissionNestedSerializer(
            (p for p in asset.permissions.all() if not p.deny),
            context=self.context, many=True, read_only=True
        ).data


class AssetListSerializer(AssetSerializer):

    class Meta(AssetSerializer.Meta):
        fields = ('url',
                  'date_modified',
                  'date_created',
                  'owner',
                  'summary',
                  'owner__username',
                  'parent',
                  'uid',
                  'tag_string',
                  'settings',
                  'kind',
                  'name',
                  'asset_type',
                  'version_id',
                  'has_deployment',
                  'deployed_version_id',
                  'deployment__identifier',
                  'deployment__active',
                  'deployment__submission_count',
                  'permissions',
                  'downloads',
                  )


class AssetUrlListSerializer(AssetSerializer):
    pass
