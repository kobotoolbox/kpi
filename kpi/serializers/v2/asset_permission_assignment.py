# coding: utf-8
from collections import defaultdict

from django.contrib.auth.models import Permission, User
from django.urls import resolve, Resolver404
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import PREFIX_PARTIAL_PERMS, SUFFIX_SUBMISSIONS_PERMS
from kpi.fields.relative_prefix_hyperlinked_related import \
    RelativePrefixHyperlinkedRelatedField
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission
from kpi.utils.urls import absolute_resolve


class AssetPermissionAssignmentSerializer(serializers.ModelSerializer):

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
    label = serializers.SerializerMethodField()

    class Meta:
        model = ObjectPermission
        fields = (
            'url',
            'user',
            'permission',
            'partial_permissions',
            'label',
        )

        read_only_fields = ('uid', 'label')

    def create(self, validated_data):
        user = validated_data['user']
        asset = validated_data['asset']
        if asset.owner_id == user.id:
            raise serializers.ValidationError({
                'user': "Owner's permissions cannot be assigned explicitly"})
        permission = validated_data['permission']
        partial_permissions = validated_data.get('partial_permissions', None)

        bulk = self.context.get('bulk', False)
        # When bulk is `True`, the `from_kc_only` flag is removed from *all*
        # users prior to calling this method. There is no need to remove it
        # again from each user individually. See
        # `AssetPermissionAssignmentViewSet.bulk_assignments()`
        # TODO: Remove after kobotoolbox/kobocat#642
        if bulk is False and asset.has_deployment:
            asset.deployment.remove_from_kc_only_flag(specific_user=user)

        return asset.assign_perm(user, permission.codename,
                                 partial_perms=partial_permissions)

    def get_label(self, object_permission):
        # `self.object_permission.label` calls `self.object_permission.asset`
        # internally. Thus, costs an extra query each time the object is
        # serialized. `asset` is already loaded and attached to context,
        # let's use it!
        try:
            asset = self.context['asset']
        except KeyError:
            return object_permission.label
        else:
            return asset.get_label_for_permission(
                object_permission.permission.codename
            )

    def get_partial_permissions(self, object_permission):
        codename = object_permission.permission.codename
        if codename.startswith(PREFIX_PARTIAL_PERMS):
            view = self.context.get('view')
            # if view doesn't have an `asset` property,
            # fallback to context. (e.g. AssetViewSet)
            asset = getattr(view, 'asset', self.context.get('asset'))
            partial_perms = asset.get_partial_perms(
                object_permission.user_id, with_filters=True)
            if not partial_perms:
                return None

            if partial_perms:
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
        return reverse('asset-permission-assignment-detail',
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

        :param attrs: dict of `{'user': '<username>',
                                'permission': <permission object>}`
        :return: dict, the `attrs` parameter updated (if necessary) with
                 validated `partial_permissions` dicts.
        """
        permission = attrs['permission']
        if not permission.codename.startswith(PREFIX_PARTIAL_PERMS):
            # No additional validation needed
            return attrs

        def _invalid_partial_permissions(message):
            raise serializers.ValidationError(
                {'partial_permissions': message}
            )

        request = self.context['request']
        partial_permissions = None

        if isinstance(request.data, dict):  # for a single assignment
            partial_permissions = request.data.get('partial_permissions')
        elif self.context.get('partial_permissions'):  # injected during bulk assignment
            partial_permissions = self.context.get('partial_permissions')

        if not partial_permissions:
            _invalid_partial_permissions(
                _("This field is required for the '{}' permission").format(
                    permission.codename
                )
            )

        partial_permissions_attr = defaultdict(list)

        for partial_permission, filters_ in \
                self.__get_partial_permissions_generator(partial_permissions):
            try:
                resolver_match = absolute_resolve(
                    partial_permission.get('url')
                )
            except (TypeError, Resolver404):
                _invalid_partial_permissions(_('Invalid `url`'))

            try:
                codename = resolver_match.kwargs['codename']
            except KeyError:
                _invalid_partial_permissions(_('Invalid `url`'))

            # Permission must valid and must be assignable.
            if not self._validate_permission(codename,
                                             SUFFIX_SUBMISSIONS_PERMS):
                _invalid_partial_permissions(_('Invalid `url`'))

            # No need to validate Mongo syntax, query will fail
            # if syntax is not correct.
            if not isinstance(filters_, dict):
                _invalid_partial_permissions(_('Invalid `filters`'))

            # Validation passed!
            partial_permissions_attr[codename].append(filters_)

        # Everything went well. Add it to `attrs`
        attrs.update({'partial_permissions': partial_permissions_attr})

        return attrs

    def validate_permission(self, permission):
        """
        Checks if permission can be assigned on asset.
        """
        if not self._validate_permission(permission.codename):
            raise serializers.ValidationError(
                _(
                    '{permission} cannot be assigned explicitly to '
                    'Asset objects of this type.'
                ).format(permission=permission.codename)
            )
        return permission

    def to_representation(self, instance):
        """
        Doesn't display 'partial_permissions' attribute if it's `None`.
        """
        try:
            # Each time we try to access `instance.label`, `instance.content_object`
            # is needed. Django can't find it from objects cache even if it already
            # exists. Because of `GenericForeignKey`, `select_related` can't be
            # used to load it within the same queryset. So Django hits DB each
            # time a label is shown. `prefetch_related` helps, but not that much.
            # It still needs to load object from DB at least once.
            # It means, when listing assets, it would add as many extra queries
            # as assets. `content_object`, in that case, is the parent asset and
            # we can access it through the context. Let's use it.
            asset = self.context['asset']
            setattr(instance, 'content_object', asset)
        except KeyError:
            pass

        repr_ = super().to_representation(instance)
        repr_copy = dict(repr_)
        for k, v in repr_copy.items():
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
        return (
            # DONOTMERGE abusive to the database server?
            codename in Asset.objects.only('asset_type').get(
                uid=self.context['asset_uid']
            ).get_assignable_permissions(
                with_partial=True
            ) and (suffix is None or codename.endswith(suffix))
        )

    def __get_partial_permissions_generator(self, partial_permissions):
        """
        Creates a generator to iterate over partial_permissions list.
        Useful to validate each item and stop iterating as soon as errors
        are detected

        :param partial_permissions: list
        :return: generator
        """
        for partial_permission in partial_permissions:
            for filters_ in partial_permission.get('filters'):
                yield partial_permission, filters_

    def __get_permission_hyperlink(self, codename):
        """
        Builds permission hyperlink representation.
        :param codename: str
        :return: str. url
        """
        return reverse('permission-detail',
                       args=(codename,),
                       request=self.context.get('request', None))


class AssetBulkInsertPermissionSerializer(AssetPermissionAssignmentSerializer):

    class Meta:
        model = ObjectPermission
        fields = (
            'user',
            'permission',
        )
