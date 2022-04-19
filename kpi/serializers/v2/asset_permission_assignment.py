# coding: utf-8
from __future__ import annotations
import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from django.contrib.auth.models import Permission, User
from django.urls import Resolver404
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PREFIX_PARTIAL_PERMS,
    SUFFIX_SUBMISSIONS_PERMS,
)
from kpi.fields.relative_prefix_hyperlinked_related import (
    RelativePrefixHyperlinkedRelatedField,
)
from kpi.models.asset import Asset, AssetUserPartialPermission
from kpi.models.object_permission import ObjectPermission
from kpi.utils.object_permission import (
    get_user_permission_assignments_queryset,
)
from kpi.utils.urls import absolute_resolve


ASSIGN_OWNER_ERROR_MESSAGE = "Owner's permissions cannot be assigned explicitly"


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
            raise serializers.ValidationError(
                {'user': t(ASSIGN_OWNER_ERROR_MESSAGE)}
            )
        permission = validated_data['permission']
        partial_permissions = validated_data.get('partial_permissions', None)

        return asset.assign_perm(
            user, permission.codename, partial_perms=partial_permissions
        )

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
            # TODO: optimize `asset.get_partial_perms()` so it doesn't execute
            # a new query for each assignment
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
                t("This field is required for the '{}' permission").format(
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
                _invalid_partial_permissions(t('Invalid `url`'))

            try:
                codename = resolver_match.kwargs['codename']
            except KeyError:
                _invalid_partial_permissions(t('Invalid `url`'))

            # Permission must valid and must be assignable.
            if not self._validate_permission(codename,
                                             SUFFIX_SUBMISSIONS_PERMS):
                _invalid_partial_permissions(t('Invalid `url`'))

            # No need to validate Mongo syntax, query will fail
            # if syntax is not correct.
            if not isinstance(filters_, dict):
                _invalid_partial_permissions(t('Invalid `filters`'))

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
                t(
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
        Search can be restricted to assignable codenames which end with `suffix`

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


class PartialPermissionField(serializers.Field):

    default_error_messages = {
        'invalid': t('Not a valid list.'),
        'blank': t('This field may not be blank.'),
    }
    initial = ''

    def __init__(self, **kwargs):
        super().__init__(required=False, **kwargs)

    def to_internal_value(self, data):
        if not isinstance(data, list):
            self.fail('invalid')
        return data

    def to_representation(self, value):
        return value


class PermissionAssignmentSerializer(serializers.Serializer):

    user = serializers.CharField()
    permission = serializers.CharField()
    partial_permissions = PartialPermissionField()


class AssetBulkInsertPermissionSerializer(serializers.Serializer):
    """
    This goal of this class is not to expose data in API endpoint,
    but to process all validation checks and convert URLs into objects at once
    to avoid multiple queries to DB vs AssetPermissionAssignmentSerializer(many=True)
    which makes a query to DB to match each RelativePrefixHyperlinkedRelatedField()
    with an Django model object.

    Warning: If less queries are sent to DB, it consumes more CPU and memory.
    The bigger the assignments are, the bigger the resources footprint will be.
    """
    assignments = serializers.ListField(child=PermissionAssignmentSerializer())

    @dataclass(frozen=True)
    class PermissionAssignment:
        """ A more-explicit alternative to a simple tuple """
        user_pk: int
        permission_codename: str
        partial_permissions_json: Optional[str] = None

    def create(self, validated_data):
        asset = self.context['asset']
        user_pk_to_obj_cache = dict()
        incoming_assignments = self.get_set_of_incoming_assignments(
            asset, validated_data['assignments'], user_pk_to_obj_cache
        )
        existing_assignments = self.get_set_of_existing_assignments(
            asset, user_pk_to_obj_cache
        )

        # Perform the removals
        for removal in existing_assignments.difference(incoming_assignments):
            asset.remove_perm(
                user_pk_to_obj_cache[removal.user_pk],
                removal.permission_codename,
            )

        # Perform the new assignments
        for addition in incoming_assignments.difference(existing_assignments):
            if asset.owner_id == addition.user_pk:
                raise serializers.ValidationError(
                    {'user': t(ASSIGN_OWNER_ERROR_MESSAGE)}
                )
            if addition.partial_permissions_json:
                partial_perms = json.loads(addition.partial_permissions_json)
            else:
                partial_perms = None
            perm = asset.assign_perm(
                user_obj=user_pk_to_obj_cache[addition.user_pk],
                perm=addition.permission_codename,
                partial_perms=partial_perms,
            )

        # Return nothing, in a nice way, because the view is responsible for
        # calling `list()` to return the assignments as they actually exist in
        # the database. That causes duplicate queries but at least ensures that
        # the front end displays accurate information even if there are bugs
        # here
        return {}

    def get_set_of_existing_assignments(
        self, asset: 'kpi.models.Asset', user_pk_to_obj_cache: dict
    ) -> set[PermissionAssignment]:
        # Get all existing partial permissions with a single query and store
        # in a dictionary where the keys are the primary key of each user
        existing_partial_perms_for_user = dict(
            asset.asset_partial_permissions.values_list('user', 'permissions')
        )

        # Build a set of all existing assignments
        existing_assignments = set()
        for assignment_in_db in (
            # It seems unnecessary to filter assignments like this since a
            # user who can change assignments can also view all
            # assignments. Maybe that will change in the future, though?
            get_user_permission_assignments_queryset(
                asset, self.context['request'].user
            )
            .exclude(user=asset.owner)
            .select_related('user', 'permission')
            .only('asset', 'user', 'permission__codename')
        ):
            # Expand the stupid cache to include any users present in the
            # existing assignments but not in the incoming assignments
            user_pk_to_obj_cache[
                assignment_in_db.user_id
            ] = assignment_in_db.user

            if assignment_in_db.permission.codename == PERM_PARTIAL_SUBMISSIONS:
                partial_permissions_json = json.dumps(
                    existing_partial_perms_for_user[assignment_in_db.user_id],
                    sort_keys=True,
                )
            else:
                partial_permissions_json = None
            existing_assignments.add(
                self.PermissionAssignment(
                    assignment_in_db.user_id,
                    assignment_in_db.permission.codename,
                    partial_permissions_json,
                )
            )

        return existing_assignments

    def get_set_of_incoming_assignments(
        self,
        asset: 'kpi.models.Asset',
        posted_assignments: list,
        user_pk_to_obj_cache: dict,
    ) -> set[PermissionAssignment]:
        # Build a set of all incoming assignments, including implied
        # assignments not explicitly sent by the front end
        incoming_assignments = set()
        for incoming_assignment in posted_assignments:
            incoming_permission = incoming_assignment['permission']
            partial_permissions = None

            # TODO: refactor permission assignment code so that it does not
            # always require a fully-fledged `User` object? Until then, keep a
            # stupid object cache thing because `assign_perm()` and
            # `remove_perm()` REQUIRE user objects
            user_pk_to_obj_cache[
                incoming_assignment['user'].pk
            ] = incoming_assignment['user']

            # Expand to include implied permissions
            for implied_codename in asset.get_implied_perms(
                incoming_permission.codename, for_instance=asset
            ):
                incoming_assignments.add(
                    self.PermissionAssignment(
                        user_pk=incoming_assignment['user'].pk,
                        permission_codename=implied_codename,
                    )
                )

            # Expand to include implied partial permissions
            if incoming_permission.codename == PERM_PARTIAL_SUBMISSIONS:
                partial_permissions = json.dumps(
                    AssetUserPartialPermission\
                    .update_partial_perms_to_include_implied(
                        asset, incoming_assignment['partial_permissions']
                    ),
                    sort_keys=True,
                )

            incoming_assignments.add(
                self.PermissionAssignment(
                    user_pk=incoming_assignment['user'].pk,
                    permission_codename=incoming_permission.codename,
                    partial_permissions_json=partial_permissions,
                )
            )

        return incoming_assignments

    def validate(self, attrs):
        """
        Validate users and permissions, and convert them from API URLs into
        model instances, using a minimal number of database queries
        """
        # A dictionary for looking up usernames by API user URLs
        url_to_username = dict()
        # …for looking up codenames by API permission URLs
        url_to_codename = dict()

        assignable_permissions = self.context[
            'asset'
        ].get_assignable_permissions(with_partial=True)

        # Perhaps not the best error messages, but they're what DRF was already
        # returning
        INVALID_PERMISSION_ERROR = {
            'permission': t('Invalid hyperlink - Object does not exist.')
        }
        INVALID_USER_ERROR = {
            'user': t('Invalid hyperlink - Object does not exist.')
        }
        # This matches the behavior of `AssetPermissionAssignmentSerializer`
        INVALID_PARTIAL_PERMISSION_ERROR = {
            'partial_permissions': t('Invalid `url`')
        }

        # Fill in the dictionaries by parsing the incoming assignments
        for assignment in attrs['assignments']:
            perm_url = assignment['permission']
            user_url = assignment['user']
            codename = self._get_arg_from_url('codename', perm_url)
            if codename not in assignable_permissions:
                raise serializers.ValidationError(INVALID_PERMISSION_ERROR)
            url_to_codename[perm_url] = codename
            username = self._get_arg_from_url('username', user_url)
            url_to_username[user_url] = username
            for partial_assignment in assignment.get('partial_permissions', []):
                partial_codename = self._get_arg_from_url(
                    'codename', partial_assignment['url']
                )
                if not (
                    partial_codename in assignable_permissions
                    and partial_codename.endswith(SUFFIX_SUBMISSIONS_PERMS)
                ):
                    raise serializers.ValidationError(
                        INVALID_PARTIAL_PERMISSION_ERROR
                    )
                url_to_codename[partial_assignment['url']] = partial_codename

        # Create a dictionary of API user URLs to `User` objects
        urls_sorted_by_username = [
            url
            for url, username in sorted(
                url_to_username.items(), key=lambda item: item[1]
            )
        ]
        url_to_user = dict(
            zip(
                urls_sorted_by_username,
                User.objects.only('pk', 'username')
                .filter(username__in=url_to_username.values())
                .order_by('username'),
            )
        )
        if len(url_to_user) != len(url_to_username):
            raise serializers.ValidationError(INVALID_USER_ERROR)

        # Create a dictionary of API permission URLs to `Permission` objects
        urls_sorted_by_codename = [
            url
            for url, codename in sorted(
                url_to_codename.items(), key=lambda item: item[1]
            )
        ]
        url_to_permission = dict(
            zip(
                urls_sorted_by_codename,
                Permission.objects.filter(codename__in=assignable_permissions)
                .filter(codename__in=url_to_codename.values())
                .order_by('codename'),
            )
        )
        if len(url_to_permission) != len(url_to_codename):
            # This should never happen since all codenames were found within
            # `assignable_permissions`
            raise RuntimeError(
                'Unexpected mismatch while processing permissions'
            )

        # Rewrite the incoming assignments, replacing user and permission URLs
        # with their corresponding model instance objects
        assignments_with_objects = []
        for assignment in attrs['assignments']:
            assignment_with_objects = {
                'user': url_to_user[assignment['user']],
                'permission': url_to_permission[assignment['permission']],
            }
            if (
                assignment_with_objects['permission'].codename
                == PERM_PARTIAL_SUBMISSIONS
            ):
                assignment_with_objects['partial_permissions'] = defaultdict(
                    list
                )
                for partial_assignment in assignment['partial_permissions']:
                    # Convert partial permission URLs to codenames only; it's
                    # unnecessary to instantiate objects for them
                    partial_codename = url_to_codename[
                        partial_assignment['url']
                    ]
                    assignment_with_objects['partial_permissions'][
                        partial_codename
                    ] = partial_assignment['filters']
            assignments_with_objects.append(assignment_with_objects)

        attrs['assignments'] = assignments_with_objects
        return attrs

    @staticmethod
    def _get_arg_from_url(arg_name: str, url: str) -> str:
        try:
            resolver_match = absolute_resolve(url)
            value = resolver_match.kwargs[arg_name]
        except (TypeError, KeyError, Resolver404):
            value = None
        return value
