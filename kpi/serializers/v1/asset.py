# -*- coding: utf-8 -*-
from __future__ import absolute_import

from kpi.serializers.v2.asset import AssetSerializer as AssetSerializerV2

from .object_permission import ObjectPermissionNestedSerializer


class AssetSerializer(AssetSerializerV2):

    class Meta(AssetSerializerV2.Meta):
        fields = ('url',
                  'owner',
                  'owner__username',
                  'parent',
                  'ancestors',
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
                  'settings',)

    permissions = ObjectPermissionNestedSerializer(many=True, read_only=True)


class AssetListSerializer(AssetSerializer):
    pass


class AssetUrlListSerializer(AssetSerializer):
    pass
