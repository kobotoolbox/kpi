# -*- coding: utf-8 -*-
from __future__ import absolute_import
from urlparse import urlparse

from django.contrib.auth.models import Permission, User
from django.core.urlresolvers import resolve
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import PREFIX_PARTIAL_PERMS, SUFFIX_SUBMISSIONS_PERMS
from kpi.fields.relative_prefix_hyperlinked_related import \
    RelativePrefixHyperlinkedRelatedField
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission


class AssetPermissionSerializer(serializers.ModelSerializer):

    url = serializers.SerializerMethodField()
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-detail',
        lookup_field='username',
        queryset=User.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
    permission = RelativePrefixHyperlinkedRelatedField(
        view_name='permission-detail',
        lookup_field='codename',
        queryset=Permission.objects.all(),
        style={'base_template': 'input.html'}  # Render as a simple text box
    )
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

    def create(self, validated_data):
        user = validated_data['user']
        asset = validated_data['asset']
        permission = validated_data['permission']
        partial_permissions = validated_data.get('partial_permissions', None)
        return asset.assign_perm(user, permission.codename,
                                 partial_perms=partial_permissions)

    def get_partial_permissions(self, object_permission):
        codename = object_permission.permission.codename
        if codename.startswith(PREFIX_PARTIAL_PERMS):
            view = self.context.get('view')
            # if view doesn't have an `asset` property,
            # fallback to context. (e.g. AssetViewSet)
            asset = getattr(view, 'asset', self.context.get('asset'))
            partial_perms = asset.get_partial_perms(
                object_permission.user_id, True)

            hyperlinked_partial_perms = []
            for perm_codename, filters in partial_perms.items():
                url = self.__get_permission_hyperlink(perm_codename)
                hyperlinked_partial_perms.append({
                    'url': url,
                    'filters': filters
                })
            return hyperlinked_partial_perms
        return None

    def get_url(self, object_permission):
        asset_uid = self.context.get('asset_uid')
        return reverse('asset-permission-detail',
                       args=(asset_uid, object_permission.uid),
                       request=self.context.get('request', None))

    def validate(self, attrs):
        # Because `partial_permissions` is a `SerializerMethodField`,
        # it's read-only, so it's not validated nor added to `validated_data`.
        # We need to do it manually
        self.validate_partial_permissions(attrs)
        return attrs

    def validate_partial_permissions(self, attrs):
        """
        Validates permissions and filters sent with partial permissions.

        If data is valid, `partial_permissions` attribute is added to `attrs`.
        Useful to permission assignment in `create()`.

        :param attrs: dict.
        :return: dict.
        """
        permission = attrs.get('permission')
        request = self.context.get('request')
        if isinstance(request.data, dict):
            partial_permissions = request.data.get('partial_permissions')
        elif self.context.get('partial_permissions'):
            partial_permissions = self.context.get('partial_permissions')
        partial_permissions_attr = {}

        if permission.codename.startswith(PREFIX_PARTIAL_PERMS):
            if partial_permissions:
                is_valid = True
                try:
                    for partial_permission, filter_ in \
                            self.__get_partial_permissions_generator(partial_permissions):

                        parse_result = urlparse(partial_permission.get('url'))
                        resolver = resolve(parse_result.path)
                        codename = resolver.kwargs.get('codename')
                        # Permission must valid and must be assignable.
                        # Ensure `filter_` is a `dict`.
                        # No need to validate Mongo syntax, query will fail
                        # if syntax is not correct.
                        if (self._validate_permission(codename,
                                                      SUFFIX_SUBMISSIONS_PERMS)
                                and isinstance(filter_, dict)):

                            if codename not in partial_permissions_attr:
                                partial_permissions_attr[codename] = []

                            partial_permissions_attr[codename].append(filter_)
                            continue

                        is_valid = False

                except (AttributeError, ValueError):
                    is_valid = False

                if not is_valid:
                    raise serializers.ValidationError('Invalid partial permissions')

                # Everything went well. Add it to `attrs`
                attrs.update({'partial_permissions': partial_permissions_attr})
            else:
                raise serializers.ValidationError(
                    "Can not assign '{}' permission. Partial permissions "
                    "are missing.".format(permission.codename))

        return attrs

    def validate_permission(self, permission):
        """
        Checks if permission can be assigned on asset.
        """
        if not self._validate_permission(permission.codename):
            raise serializers.ValidationError(
                '{} cannot be assigned explicitly to Asset objects.'.format(
                    permission.codename))
        return permission

    def to_representation(self, instance):
        """
        Doesn't display 'partial_permissions' attribute if it's `None`.
        """
        repr_ = super(AssetPermissionSerializer, self).to_representation(instance)
        for k, v in repr_.items():
            if k == 'partial_permissions' and v is None:
                del repr_[k]

        return repr_

    def _validate_permission(self, codename, suffix=None):
        """
        Validates if `codename` can be assigned on `Asset`s.
        Search can be restricted to assignable codenames which end with `prefix`

        :param codename: str. See `Asset.ASSIGNABLE_PERMISSIONS
        :param suffix: str.
        :return: bool.
        """
        return (codename in Asset.get_assignable_permissions(with_partial=True)
                and (suffix is None or codename.endswith(suffix)))

    def __get_partial_permissions_generator(self, partial_permissions):
        """
        Creates a generator to iterate over partial_permissions list.
        Useful to validate each item and stop iterating as soon as errors
        are detected

        :param partial_permissions: list
        :return: generator
        """
        for partial_permission in partial_permissions:
            for filter_ in partial_permission.get('filters'):
                yield partial_permission, filter_

    def __get_permission_hyperlink(self, codename):
        """
        Builds permission hyperlink representation.
        :param codename: str
        :return: str. url
        """
        return reverse('permission-detail',
                       args=(codename,),
                       request=self.context.get('request', None))


class AssetBulkInsertPermissionSerializer(AssetPermissionSerializer):

    class Meta:
        model = ObjectPermission
        fields = (
            'user',
            'permission',
        )

    def create(self, validated_data):
        view = self.context.get('view')
        validated_data['asset'] = view.asset
        return super(AssetBulkInsertPermissionSerializer, self).create(validated_data)
