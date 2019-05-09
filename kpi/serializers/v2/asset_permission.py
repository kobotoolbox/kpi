# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.contrib.auth.models import User
from rest_framework import serializers

from kpi.fields.relative_prefix_hyperlinked_related import \
    RelativePrefixHyperlinkedRelatedField
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
    permission = serializers.SerializerMethodField()

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
        )

        read_only_fields = ('uid', )

    def get_permission(self, object_permission):
        codename = object_permission.permission.codename
        return UrlHelper.reverse('permission-detail',
                                 args=(codename,),
                                 request=self.context.get('request', None),
                                 context=self.context)

    def get_url(self, object_permission):
        asset_uid = self.context.get('asset_uid')
        return UrlHelper.reverse('asset-permission-detail',
                                 args=(asset_uid, object_permission.uid),
                                 request=self.context.get('request', None),
                                 context=self.context)

