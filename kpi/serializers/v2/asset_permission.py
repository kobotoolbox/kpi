# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.contrib.auth.models import User
from rest_framework import serializers

from kpi.fields.relative_prefix_hyperlinked_related import \
    RelativePrefixHyperlinkedRelatedField
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission
from kpi.utils.url_helper import UrlHelper


class AssetPermissionSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        queryset=User.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
        )

        read_only_fields = ('uid', )

    def get_url(self, assignment):
        asset_uid = self.context.get('asset_uid')
        return UrlHelper.reverse('asset-permission-detail',
                                 args=(asset_uid, assignment.uid),
                                 request=self.context.get('request', None),
                                 context=self.context)
