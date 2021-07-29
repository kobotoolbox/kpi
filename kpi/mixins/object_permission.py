# coding: utf-8
import copy
from collections import defaultdict
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import User, AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django_request_cache import cache_for_request
from rest_framework import serializers

from kpi.constants import (
    ASSET_TYPES_WITH_CHILDREN,
    ASSET_TYPE_SURVEY,
    PREFIX_PARTIAL_PERMS,
)
from kpi.deployment_backends.kc_access.utils import (
    remove_applicable_kc_permissions,
    assign_applicable_kc_permissions
)
from kpi.models.object_permission import ObjectPermission
from kpi.utils.object_permission import (
    get_database_user,
    perm_parse,
)
from kpi.utils.permissions import is_user_anonymous


class ObjectPermissionMixin:
    """
    A mixin class that adds the methods necessary for object-level permissions
    to a model. The model must define parent, ASSIGNABLE_PERMISSIONS_BY_TYPE,
    CALCULATED_PERMISSIONS, and HERITABLE_PERMISSIONS. A post_delete signal
    receiver should also clean up any ObjectPermission records associated with
    the model instance.  The MRO is important, so be sure to include this mixin
    before the base class in your model definition, e.g.
        class MyAwesomeModel(ObjectPermissionMixin, models.Model)
    """

    CONTRADICTORY_PERMISSIONS = {}

    def get_assignable_permissions(
        self, with_partial: bool = True, ignore_type: bool = False
    ) -> tuple:
        """
        The "versioned app registry" used during migrations apparently does
        not store non-database attributes, so this awful workaround is needed

        Returns assignable permissions including permissions prefixed by
        `PREFIX_PARTIAL_PERMS` if `with_partial` is True.

        Attempts to return only permissions relevant to the asset type when
        `instance` is provided. This feels like a bit of a hack; sorry.

        It can be useful to remove the partial permissions when assigning
        permissions to owner of the object.
        """

        assignable_permissions = self.ASSIGNABLE_PERMISSIONS
        if not ignore_type:
            try:
                assignable_permissions = (
                    self.ASSIGNABLE_PERMISSIONS_BY_TYPE[self.asset_type]
                )
            except AttributeError:
                pass

        if with_partial is False:
            assignable_permissions = tuple(ap for ap in assignable_permissions
                                           if not ap.startswith(
                                               PREFIX_PARTIAL_PERMS)
                                           )

        return assignable_permissions

    @transaction.atomic
    def copy_permissions_from(self, source_object):
        """
        Copies permissions from `source_object` to `self` object.
        Both objects must have the same type.

        :param source_object: Asset
        :return: Boolean
        """

        # We can only copy permissions between objects from the same type.
        if type(source_object) is type(self):
            # First delete all permissions of the target asset (except owner's).
            self.permissions.exclude(user_id=self.owner_id).delete()
            # Then copy all permissions from source to target asset
            source_permissions = list(source_object.permissions.all())
            for source_permission in source_permissions:
                # Only need to reassign permissions if user is not the owner
                if source_permission.user_id != self.owner_id:
                    kwargs = {
                        'user_obj': source_permission.user,
                        'perm': source_permission.permission.codename,
                        'deny': source_permission.deny
                    }
                    if source_permission.permission.codename.startswith(PREFIX_PARTIAL_PERMS):
                        kwargs.update({
                            'partial_perms': source_object.get_partial_perms(
                                source_permission.user_id, with_filters=True)
                        })
                    self.assign_perm(**kwargs)
            self._recalculate_inherited_perms()
            return True
        else:
            return False

    @transaction.atomic
    def save(self, *args, **kwargs):
        # Make sure we exist in the database before proceeding
        super().save(*args, **kwargs)
        # Recalculate self and all descendants
        # TODO: Don't do this when the modification is trivial, e.g. a
        # collection was renamed
        self._recalculate_inherited_perms()
        self.recalculate_descendants_perms()

    def _filter_anonymous_perms(self, unfiltered_set):
        """
        Restrict a set of tuples in the format (user_id, permission_id) to
        only those permissions that apply to the content_type of this object
        and are listed in settings.ALLOWED_ANONYMOUS_PERMISSIONS.
        """
        content_type = ContentType.objects.get_for_model(self)
        # Translate settings.ALLOWED_ANONYMOUS_PERMISSIONS to primary keys
        codenames = set()
        for perm in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
            app_label, codename = perm_parse(perm)
            if app_label == content_type.app_label:
                codenames.add(codename)
        allowed_permission_ids = Permission.objects.filter(
            content_type_id=content_type.pk, codename__in=codenames
        ).values_list('pk', flat=True)
        filtered_set = copy.copy(unfiltered_set)
        for user_id, permission_id in unfiltered_set:
            if user_id == settings.ANONYMOUS_USER_ID:
                if permission_id not in allowed_permission_ids:
                    filtered_set.remove((user_id, permission_id))
        return filtered_set

    def _get_effective_perms(
        self, user=None, codename=None, include_calculated=True
    ):
        """ Reconcile all grant and deny permissions, and return an
        authoritative set of grant permissions (i.e. deny=False) for the
        current object. """
        # Including calculated permissions means we can't just pass kwargs
        # through to filter(), but we'll map the ones we understand.
        kwargs = {}
        if user is not None:
            kwargs['user'] = user
        if codename is not None:
            kwargs['codename'] = codename

        grant_perms = self.__get_object_permissions(deny=False, **kwargs)
        deny_perms = self.__get_object_permissions(deny=True, **kwargs)

        effective_perms = grant_perms.difference(deny_perms)
        # Sometimes only the explicitly assigned permissions are wanted,
        # e.g. when calculating inherited permissions
        if not include_calculated:
            # Double-check that the list includes only permissions for
            # anonymous users that are allowed by the settings. Other
            # permissions would be denied by has_perm() anyway.
            if user is None or user.pk == settings.ANONYMOUS_USER_ID:
                return self._filter_anonymous_perms(effective_perms)
            else:
                # Anonymous users weren't considered; no filtering is necessary
                return effective_perms

        # Add the calculated `delete_` permission for the owner
        content_type = ContentType.objects.get_for_model(self)
        if (
            self.owner is not None
            and (user is None or user.pk == self.owner.pk)
            and (codename is None or codename.startswith('delete_'))
        ):
            matching_permissions = self.__get_permissions_for_content_type(
                content_type.pk, codename__startswith='delete_'
            )
            # FIXME: `Asset`-specific logic does not belong in this generic
            # mixin
            if self.asset_type != ASSET_TYPE_SURVEY:
                matching_permissions = matching_permissions.exclude(
                    codename__endswith='_submissions'
                )

            for perm_pk, perm_codename in matching_permissions:
                if codename is not None and perm_codename != codename:
                    # If the caller specified `codename`, skip anything that
                    # doesn't match exactly. Necessary because `Asset` has
                    # `delete_submissions` in addition to `delete_asset`
                    continue
                effective_perms.add((self.owner.pk, perm_pk))

        # We may have calculated more permissions for anonymous users
        # than they are allowed to have. Remove them.
        if user is None or user.pk == settings.ANONYMOUS_USER_ID:
            return self._filter_anonymous_perms(effective_perms)
        else:
            # Anonymous users weren't considered; no filtering is necessary
            return effective_perms

    def recalculate_descendants_perms(self):
        if self.asset_type not in ASSET_TYPES_WITH_CHILDREN:
            # It's impossible for us to have descendants. Move along...
            return
        children = list(self.children.only('pk', 'owner', 'parent'))
        if not children:
            return
        effective_perms = self._get_effective_perms(include_calculated=False)
        for child in children:
            # remove stale inherited perms
            child.permissions.filter(inherited=True).delete()
            # calc the new ones
            child._recalculate_inherited_perms(
                parent_effective_perms=effective_perms,
                stale_already_deleted=True,
                #return_instead_of_creating=True
            )
            # recurse!
            child.recalculate_descendants_perms()

    def _recalculate_inherited_perms(
            self,
            parent_effective_perms=None,
            stale_already_deleted=False,
            return_instead_of_creating=False,
            translate_perm={}  # mutable default parameter serves as cache
    ):
        """
        Copy all of our parent's effective permissions to ourself,
        marking the copies as inherited permissions. The owner's rights are
        also made explicit as "inherited" permissions.
        """
        # Start with a clean slate
        if not stale_already_deleted:
            self.permissions.filter(inherited=True).delete()
        content_type = ContentType.objects.get_for_model(self)
        if return_instead_of_creating:
            # Conditionally create this so that Python will raise an exception
            # if we use it when we're not supposed to
            objects_to_return = []
        # The owner gets every assignable permission
        if self.owner is not None:
            for perm in Permission.objects.filter(
                content_type=content_type,
                codename__in=self.get_assignable_permissions(
                    with_partial=False,
                ),
            ):
                new_permission = ObjectPermission()
                new_permission.asset = self
                # `user_id` instead of `user` is another workaround for
                # migrations
                new_permission.user_id = self.owner_id
                new_permission.permission = perm
                new_permission.inherited = True
                new_permission.uid = new_permission._meta.get_field(
                    'uid').generate_uid()
                if return_instead_of_creating:
                    objects_to_return.append(new_permission)
                else:
                    new_permission.save()
        # Is there anything to inherit?
        if self.parent is not None:
            # Get our parent's effective permissions from the database if they
            # were not passed in as an argument
            if parent_effective_perms is None:
                parent_effective_perms = self.parent._get_effective_perms(
                    include_calculated=False)
            # All our parent's effective permissions become our inherited
            # permissions. Store translations in the translate_perm dictionary
            # to minimize invocations of the Django machinery
            for user_id, permission_id in parent_effective_perms:
                if user_id == self.owner_id:
                    # The owner already has every assignable permission
                    continue
                try:
                    translated_id = translate_perm[permission_id]
                except KeyError:
                    parent_perm = Permission.objects.get(pk=permission_id)
                    try:
                        translated_codename = self.HERITABLE_PERMISSIONS[
                            parent_perm.codename
                        ]
                    except KeyError:
                        # We haven't been configured to inherit this
                        # permission from our parent, so skip it
                        continue
                    translated_id = Permission.objects.get(
                        content_type__app_label=\
                            parent_perm.content_type.app_label,
                        codename=translated_codename
                    ).pk
                    translate_perm[permission_id] = translated_id
                permission_id = translated_id
                new_permission = ObjectPermission()
                new_permission.asset = self
                new_permission.user_id = user_id
                new_permission.permission_id = permission_id
                new_permission.inherited = True
                new_permission.uid = new_permission._meta.get_field(
                    'uid').generate_uid()
                if return_instead_of_creating:
                    objects_to_return.append(new_permission)
                else:
                    new_permission.save()
        if return_instead_of_creating:
            return objects_to_return

    @classmethod
    def get_implied_perms(cls, explicit_perm, reverse=False, for_instance=None):
        """
        Determine which permissions are implied by `explicit_perm` based on
        the `IMPLIED_PERMISSIONS` attribute.
        :param explicit_perm: str. The `codename` of the explicitly-assigned
            permission.
        :param reverse: bool When `True`, exchange the keys and values of
            `IMPLIED_PERMISSIONS`. Useful for working with `deny=True`
            permissions. Defaults to `False`.
        :rtype: set of `codename`s
        """
        # TODO: document `for_instance` NOMERGE
        implied_perms_dict = getattr(cls, 'IMPLIED_PERMISSIONS', {})
        if reverse:
            reverse_perms_dict = defaultdict(list)
            for src_perm, dest_perms in implied_perms_dict.items():
                for dest_perm in dest_perms:
                    reverse_perms_dict[dest_perm].append(src_perm)
            implied_perms_dict = reverse_perms_dict

        perms_to_process = [explicit_perm]
        result = set()
        while perms_to_process:
            this_explicit_perm = perms_to_process.pop()
            try:
                implied_perms = implied_perms_dict[this_explicit_perm]
            except KeyError:
                continue
            perms_to_process.extend(set(implied_perms).difference(result))
            result.update(implied_perms)

        if for_instance:
            # Include only permissions that can be assigned to this asset type
            # FIXME: since this method is clearly `Asset`-specific, it does not
            # belong in this generic mixin
            return result.intersection(
                cls.ASSIGNABLE_PERMISSIONS_BY_TYPE[for_instance.asset_type]
            )
        else:
            return result

    @classmethod
    def get_all_implied_perms(cls, for_instance=None):
        """
        Return a dictionary with permission codenames as keys and a complete
        list of implied permissions as each value. For example, given a model
        with:
        ```
        IMPLIED_PERMISSIONS = {
            'view_submissions': ('view_asset'),
            'change_submissions': ('view_submissions'),
        }
        ```
        this method will return
        ```
        {
            'view_submissions': ['view_asset'],
            'change_submissions': ['view_asset', 'view_submission']
        }
        ```
        instead of
        ```
        {
            'view_submissions': ['view_asset'],
            'change_submissions': ['view_submissions']
        }
        ```
        """
        # TODO: document `for_instance` NOMERGE
        return {
            codename: list(cls.get_implied_perms(codename, for_instance))
            for codename in cls.IMPLIED_PERMISSIONS.keys()
        }

    @transaction.atomic
    def assign_perm(self, user_obj, perm, deny=False, defer_recalc=False,
                    skip_kc=False, partial_perms=None):
        r"""
            Assign `user_obj` the given `perm` on this object, or break
            inheritance from a parent object. By default, recalculate
            descendant objects' permissions and apply any applicable KC
            permissions.
            :type user_obj: :py:class:`User` or :py:class:`AnonymousUser`
            :param perm: str. The `codename` of the `Permission`
            :param deny: bool. When `True`, break inheritance from parent object
            :param defer_recalc: bool. When `True`, skip recalculating
                descendants
            :param skip_kc: bool. When `True`, skip assignment of applicable KC
                permissions
            :param partial_perms: dict. Filters used to narrow down query for
              partial permissions
        """
        app_label, codename = perm_parse(perm, self)
        assignable_permissions = self.get_assignable_permissions()
        if codename not in assignable_permissions:
            # Some permissions are calculated and not stored in the database
            raise serializers.ValidationError({
                'permission': f'{codename} cannot be assigned explicitly to {self}'
            })
        is_anonymous = is_user_anonymous(user_obj)
        user_obj = get_database_user(user_obj)
        if is_anonymous:
            # Is an anonymous user allowed to have this permission?
            fq_permission = f'{app_label}.{codename}'
            if (
                not deny
                and fq_permission not in settings.ALLOWED_ANONYMOUS_PERMISSIONS
            ):
                raise serializers.ValidationError({
                    'permission': f'Anonymous users cannot be granted the permission {codename}.'
                })
        perm_model = Permission.objects.get(
            content_type__app_label=app_label,
            codename=codename
        )
        existing_perms = self.permissions.filter(user=user_obj)
        identical_existing_perm = existing_perms.filter(
            inherited=False,
            permission_id=perm_model.pk,
            deny=deny,
        )
        if identical_existing_perm.exists():
            # We need to always update partial permissions because
            # they may have changed even if `perm` is the same.
            self._update_partial_permissions(user_obj, perm,
                                             partial_perms=partial_perms)
            # The user already has this permission directly applied
            return identical_existing_perm.first()

        # Remove any explicitly-defined contradictory grants or denials
        contradictory_filters = models.Q(
            user=user_obj,
            permission_id=perm_model.pk,
            deny=not deny,
            inherited=False
        )
        if not deny and perm in self.CONTRADICTORY_PERMISSIONS.keys():
            contradictory_filters |= models.Q(
                user=user_obj,
                permission__codename__in=self.CONTRADICTORY_PERMISSIONS.get(perm),
            )
        contradictory_perms = existing_perms.filter(contradictory_filters)
        contradictory_codenames = list(contradictory_perms.values_list(
            'permission__codename', flat=True))

        contradictory_perms.delete()
        # Check if any KC permissions should be removed as well
        if deny and not skip_kc:
            remove_applicable_kc_permissions(
                self, user_obj, contradictory_codenames)
        # Create the new permission
        new_permission = ObjectPermission.objects.create(
            asset=self,
            user=user_obj,
            permission_id=perm_model.pk,
            deny=deny,
            inherited=False
        )
        # Assign any applicable KC permissions
        if not deny and not skip_kc:
            assign_applicable_kc_permissions(self, user_obj, codename)
        # Resolve implied permissions, e.g. granting change implies granting
        # view
        implied_perms = self.get_implied_perms(
            codename, reverse=deny, for_instance=self
        ).intersection(assignable_permissions)
        for implied_perm in implied_perms:
            self.assign_perm(
                user_obj, implied_perm, deny=deny, defer_recalc=True)
        # We might have been called by ourselves to assign a related
        # permission. In that case, don't recalculate here.
        if defer_recalc:
            return new_permission

        self._update_partial_permissions(user_obj, perm,
                                         partial_perms=partial_perms)

        # Recalculate all descendants
        self.recalculate_descendants_perms()
        return new_permission

    def get_perms(self, user_obj):
        """
        Return a list of codenames of all effective grant permissions that
        user_obj has on this object.
        """
        user_perm_ids = self._get_effective_perms(user=user_obj)
        perm_ids = [x[1] for x in user_perm_ids]
        return Permission.objects.filter(pk__in=perm_ids).values_list(
            'codename', flat=True)

    def get_partial_perms(self, user_id, with_filters=False):
        """
        Returns the list of partial permissions related to the user.

        Should be implemented on classes that inherit from this mixin
        """
        return []

    def get_filters_for_partial_perm(self, user_id, perm=None):
        """
        Returns the list of (Mongo) filters for a specific permission `perm`
        and this specific object.

        Should be implemented on classes that inherit from this mixin
        """
        return None

    def get_users_with_perms(self, attach_perms=False):
        """ Return a QuerySet of all users with any effective grant permission
        on this object. If attach_perms=True, then return a dict with
        users as the keys and lists of their permissions as the values. """
        user_perm_ids = self._get_effective_perms()
        if attach_perms:
            user_perm_dict = {}
            for user_id, perm_id in user_perm_ids:
                perm_list = user_perm_dict.get(user_id, [])
                perm_list.append(Permission.objects.get(pk=perm_id).codename)
                user_perm_dict[user_id] = sorted(perm_list)
            # Resolve user ids into actual user objects
            user_perm_dict = {User.objects.get(pk=key): value for key, value
                              in user_perm_dict.items()}
            return user_perm_dict
        else:
            # Use a set to avoid duplicate users
            user_ids = {x[0] for x in user_perm_ids}
            return User.objects.filter(pk__in=user_ids)

    def has_perm(self, user_obj: User, perm: str) -> bool:
        """
        Does `user_obj` have perm on this object? (True/False)
        """
        app_label, codename = perm_parse(perm, self)
        is_anonymous = is_user_anonymous(user_obj)
        user_obj = get_database_user(user_obj)
        # Treat superusers the way django.contrib.auth does
        if user_obj.is_active and user_obj.is_superuser:
            return True
        # Look for matching permissions
        result = len(self._get_effective_perms(
            user=user_obj,
            codename=codename
        )) == 1
        if not result and not is_anonymous:
            # The user-specific test failed, but does the public have access?
            result = self.has_perm(AnonymousUser(), perm)
        if result and is_anonymous:
            # Is an anonymous user allowed to have this permission?
            fq_permission = '{}.{}'.format(app_label, codename)
            if fq_permission not in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                return False
        return result

    def has_perms(self, user_obj: User, perms: list, all_: bool = True) -> bool:
        """
        Returns True or False whether user `user_obj` has several
        permissions (`perms`) on current object.
        if `all_` is `True`, user must have all permissions, not only one of
        them.
        """
        fn = any if not all_ else all
        return fn(perm in perms for perm in self.get_perms(user_obj))

    @transaction.atomic
    def remove_perm(self, user_obj, perm, defer_recalc=False, skip_kc=False):
        """
            Revoke the given `perm` on this object from `user_obj`. By default,
            recalculate descendant objects' permissions and remove any
            applicable KC permissions.  May delete granted permissions or add
            deny permissions as appropriate:
            Current access      Action
            ==============      ======
            None                None
            Direct              Remove direct permission
            Inherited           Add deny permission
            Direct & Inherited  Remove direct permission; add deny permission
            :type user_obj: :py:class:`User` or :py:class:`AnonymousUser`
            :param perm str: The `codename` of the `Permission`
            :param defer_recalc bool: When `True`, skip recalculating
                descendants
            :param skip_kc bool: When `True`, skip assignment of applicable KC
                permissions
        """
        user_obj = get_database_user(user_obj)
        app_label, codename = perm_parse(perm, self)
        # Get all assignable permissions, regardless of asset type. That way,
        # we can allow invalid permissions to be removed
        if codename not in self.get_assignable_permissions(ignore_type=True):
            # Some permissions are calculated and not stored in the database
            raise serializers.ValidationError({
                'permission': f'{codename} cannot be removed explicitly.'
            })
        all_permissions = self.permissions.filter(
            user=user_obj,
            permission__codename=codename,
            deny=False
        )
        direct_permissions = all_permissions.filter(inherited=False)
        inherited_permissions = all_permissions.filter(inherited=True)
        # Resolve implied permissions, e.g. revoking view implies revoking
        # change
        implied_perms = self.get_implied_perms(
            codename, reverse=True, for_instance=self
        )
        for implied_perm in implied_perms:
            self.remove_perm(
                user_obj, implied_perm, defer_recalc=True)
        # Delete directly assigned permissions, if any
        direct_permissions.delete()
        if inherited_permissions.exists():
            # Delete inherited permissions
            inherited_permissions.delete()
            # Add a deny permission to block future inheritance
            self.assign_perm(user_obj, perm, deny=True, defer_recalc=True)
        # Remove any applicable KC permissions
        if not skip_kc:
            remove_applicable_kc_permissions(self, user_obj, codename)

        # We might have been called by ourself to assign a related
        # permission. In that case, don't recalculate here.
        if defer_recalc:
            return

        self._update_partial_permissions(user_obj, perm, remove=True)
        # Recalculate all descendants
        self.recalculate_descendants_perms()

    def _update_partial_permissions(
        self,
        user: User,
        perm: str,
        remove: bool = False,
        partial_perms: Optional[dict] = None,
    ):
        # Class is not an abstract class. Just pass.
        # Let the dev implement within the classes that inherit from this mixin
        pass

    @staticmethod
    @cache_for_request
    def __get_all_object_permissions(object_id):
        """
        Retrieves all object permissions and builds an dict with user ids as keys.
        Useful to retrieve permissions for several users in a row without
        hitting DB again & again (thanks to `@cache_for_request`)

        Because `django_cache_request` creates its keys based on method's arguments,
        it's important to minimize its number to hit the cache as much as possible.
        This method should be called when object permissions for a specific object
        are needed several times in a row (within the same request).

        It will hit the DB once for this object. If object permissions are needed
        for an another user, in subsequent calls, they can be easily retrieved
        by the returned dict keys.

        Args:
            object_id (int): Object's pk

        Returns:
            dict: {
                '<user_id>': [
                    (permission_id, permission_codename, deny),
                    (permission_id, permission_codename, deny),
                    ...
                ],
                '<user_id>': [
                    (permission_id, permission_codename, deny),
                    (permission_id, permission_codename, deny),
                    ...
                ]
            }
        """
        records = ObjectPermission.objects. \
            filter(asset_id=object_id). \
            values('user_id',
                   'permission_id',
                   'permission__codename',
                   'deny')
        object_permissions_per_user = defaultdict(list)
        for record in records:
            object_permissions_per_user[record['user_id']].append((
                record['permission_id'],
                record['permission__codename'],
                record['deny'],
            ))

        return object_permissions_per_user

    @staticmethod
    @cache_for_request
    def __get_all_user_permissions(user_id):
        """
        Retrieves all object permissions and builds an dict with object ids as keys.
        Useful to retrieve permissions (thanks to `@cache_for_request`)
        for several objects in a row without fetching data from data again & again

        Because `django_cache_request` creates its keys based on method's arguments,
        it's important to minimize their number to hit the cache as much as possible.
        This method should be called when object permissions for a specific user
        are needed several times in a row (within the same request).

        It will hit the DB once for this user. If object permissions are needed
        for an another object (i.e. `Asset`), in subsequent calls,
        they can be easily retrieved by the returned dict keys.

        Args:
            user_id (int): User's pk

        Returns:
            dict: {
                '<object_id>': [
                    (permission_id, permission_codename, deny),
                    (permission_id, permission_codename, deny),
                    ...
                ],
                '<object_id>': [
                    (permission_id, permission_codename, deny),
                    (permission_id, permission_codename, deny),
                    ...
                ]
            }
        """
        records = ObjectPermission.objects.filter(user=user_id).values(
            'asset_id', 'permission_id', 'permission__codename', 'deny'
        )
        object_permissions_per_object = defaultdict(list)
        for record in records:
            object_permissions_per_object[record['asset_id']].append((
                record['permission_id'],
                record['permission__codename'],
                record['deny'],
            ))

        return object_permissions_per_object

    def __get_object_permissions(self, deny, user=None, codename=None):
        """
        Returns a set of user ids and object permission ids related to
        object `self`.

        Args:
            deny (bool): If `True`, returns denied permissions
            user (User)
            codename (str)

        Returns:
            set: [(User's pk, Permission's pk)]
        """

        def build_dict(user_id_, object_permissions_):
            perms_ = []
            if object_permissions_:
                for permission_id, codename_, deny_ in object_permissions_:
                    if (deny_ is not deny or
                            codename is not None and
                            codename != codename_):
                        continue
                    perms_.append((user_id_, permission_id))
            return perms_

        perms = []
        # If User is not none, retrieve all permissions for this user
        # grouped by object ids, otherwise, retrieve all permissions for
        # this object grouped by user ids.
        if user is not None:
            # Ensuring that the user has at least anonymous permissions if they
            # have been assigned to the asset
            all_anon_object_permissions = self.__get_all_user_permissions(
                user_id=settings.ANONYMOUS_USER_ID
            )
            perms = build_dict(
                settings.ANONYMOUS_USER_ID,
                all_anon_object_permissions.get(self.pk),
            )
            if not is_user_anonymous(user):
                all_object_permissions = self.__get_all_user_permissions(
                    user_id=user.pk
                )
                perms += build_dict(
                    user.pk, all_object_permissions.get(self.pk)
                )
        else:
            all_object_permissions = self.__get_all_object_permissions(
                object_id=self.pk
            )
            for user_id, object_permissions in all_object_permissions.items():
                perms += build_dict(user_id, object_permissions)

        return set(perms)

    @staticmethod
    @cache_for_request
    def __get_permissions_for_content_type(content_type_id,
                                           codename=None,
                                           codename__startswith=None):
        """
        Gets permissions for specific content type and permission's codename
        This method is cached per request because it can be called several times
        in a row in the same request.

        Args:
            content_type_id (int): ContentType primary key
            codename (str)
            codename__startswith (str)

        Returns:
            mixed: If `first` is `True` returns a tuple.
                   Otherwise a list of tuples
                   The tuple consists of permission's pk and its codename.
        """
        filters = {'content_type_id': content_type_id}
        if codename is not None:
            filters['codename'] = codename

        if codename__startswith is not None:
            filters['codename__startswith'] = codename__startswith

        permissions = Permission.objects.filter(**filters). \
            values_list('pk', 'codename')

        return permissions
