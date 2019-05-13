# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.contrib.auth.models import User
from rest_framework import serializers

from kpi.constants import PREFIX_PARTIAL_PERMS
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
    partial_permissions = serializers.SerializerMethodField()

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
            'partial_permissions'
        )

        read_only_fields = ('uid', )

    def get_partial_permissions(self, object_permission):
        codename = object_permission.permission.codename
        if codename.startswith(PREFIX_PARTIAL_PERMS):
            view = self.context.get('view')
            asset = view.asset
            partial_perms = asset.get_partial_perms(
                object_permission.user_id, True)

            hyperlinked_partial_perms = {}
            for perm_codename, users in partial_perms.items():
                url = self.__get_permission_hyperlink(perm_codename)
                hyperlinked_partial_perms[perm_codename] = {
                    'url': url,
                    'users': [self.__get_user_hyperlink(user) for user in users]
                }
            return hyperlinked_partial_perms
        return None

    def get_permission(self, object_permission):
        codename = object_permission.permission.codename
        return self.__get_permission_hyperlink(codename)

    def get_url(self, object_permission):
        asset_uid = self.context.get('asset_uid')
        return UrlHelper.reverse('asset-permission-detail',
                                 args=(asset_uid, object_permission.uid),
                                 request=self.context.get('request', None),
                                 context=self.context)

    def to_representation(self, instance):
        """
        Doesn't display 'partial_permissions' attribute if it's `None`.
        """
        repr_ = super(AssetPermissionSerializer, self).to_representation(instance)
        for k, v in repr_.items():
            if k == 'partial_permissions' and v is None:
                del repr_[k]

        return repr_

    def __get_permission_hyperlink(self, codename):
        return UrlHelper.reverse('permission-detail',
                                 args=(codename,),
                                 request=self.context.get('request', None),
                                 context=self.context)

    def __get_user_hyperlink(self, username):
        return UrlHelper.reverse('user-detail',
                                 args=(username,),
                                 request=self.context.get('request', None),
                                 context=self.context)

