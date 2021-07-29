# coding: utf-8
from collections import defaultdict
from typing import Union

from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import User, Permission, AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.shortcuts import _get_queryset
from django_request_cache import cache_for_request
from rest_framework import serializers

from kpi.constants import PERM_MANAGE_ASSET, PERM_FROM_KC_ONLY
from kpi.utils.permissions import is_user_anonymous


def get_all_objects_for_user(user, klass):
    """
    Return all objects of type klass to which user has been assigned any
    permission.
    """
    if ('kpi', 'asset') != (klass._meta.app_label, klass._meta.model_name):
        # Transitioning away from generic-relation ObjectPermission
        raise NotImplementedError

    return klass.objects.filter(permissions__user=user).distinct()


@cache_for_request
def get_cached_code_names(model_: models.Model = None) -> dict:
    """
    Creates a dictionary from `auth_permission` table and saves it in cache
    during the request life.
    Avoids several accesses to DB to fetch permission ids (or names)
    which only change after migrations.

    Args:
        model_: Any model of `settings.INSTALLED_APPS`.
                It's narrowed down to `Asset` by default

    Returns:
        dict: a dictionary of code names and ids
    """
    if model_ is None:
        # referencing `Asset` this way avoids a circular import
        model_ = apps.get_model('kpi.asset')

    content_type = ContentType.objects.get_for_model(model_)

    records = Permission.objects.values('id', 'codename', 'name').filter(
        content_type=content_type)

    perm_ids_from_code_names = defaultdict(dict)
    for record in records:
        perm_ids_from_code_names[record['codename']] = {
            'id': record['id'],
            'name': record['name']
        }

    return perm_ids_from_code_names


@cache_for_request
def get_anonymous_user():
    """ Return a real User in the database to represent AnonymousUser. """
    try:
        user = User.objects.get(pk=settings.ANONYMOUS_USER_ID)
    except User.DoesNotExist:
        username = getattr(
            settings,
            'ANONYMOUS_DEFAULT_USERNAME_VALUE',
            'AnonymousUser'
        )
        user = User.objects.create(
            pk=settings.ANONYMOUS_USER_ID,
            username=username
        )
    return user


def get_database_user(user: Union[User, AnonymousUser]) -> User:
    """
    Returns a real `User` object if `user` is an `AnonymousUser`, otherwise
    returns `user` unchanged
    """
    if user.is_anonymous:
        user = get_anonymous_user()
    return user


def get_objects_for_user(
    user,
    perms,
    klass=None,
    all_perms_required=True,
):
    """
    A simplified version of django-guardian's get_objects_for_user shortcut.
    Returns queryset of objects for which a given ``user`` has *all*
    permissions present at ``perms``.
    :param user: ``User`` or ``AnonymousUser`` instance for which objects would
      be returned.
    :param perms: single permission string, or sequence of permission strings
      which should be checked.
      If ``klass`` parameter is not given, those should be full permission
      names rather than only codenames (i.e. ``auth.change_user``). If more than
      one permission is present within sequence, their content type **must** be
      the same or ``ValidationError`` exception will be raised.
    :param klass: may be a Model, Manager or QuerySet object. If not given
      this parameter will be computed based on given ``params``.
    :param all_perms_required: If False, users should have at least one
      of the `perms`
    """
    app_label = 'kpi'
    if klass is None:
        # referencing `Asset` this way avoids a circular import
        queryset = apps.get_model('kpi.asset').objects.all()
    else:
        queryset = _get_queryset(klass)
        if (app_label, 'asset') != (
            queryset.model._meta.app_label,
            queryset.model._meta.model_name,
        ):
            # Transitioning away from generic-relation ObjectPermission
            raise NotImplementedError

    if isinstance(perms, str):
        perms = [perms]

    codenames = set()
    # Compute codenames set
    for perm in perms:
        if '.' in perm:
            new_app_label, codename = perm.split('.', 1)
            if app_label != new_app_label:
                # Transitioning away from generic-relation ObjectPermission
                raise NotImplementedError
        else:
            codename = perm
        codenames.add(codename)

    # Check if the user is anonymous. The
    # django.contrib.auth.models.AnonymousUser object doesn't work for
    # queries, and it's nice to be able to pass in request.user blindly.
    user = get_database_user(user)

    if all_perms_required:
        for codename in codenames:
            perm_id = get_perm_ids_from_code_names(codename)
            queryset = queryset.filter(
                permissions__user=user,
                permissions__permission_id=perm_id,
                permissions__deny=False,
            )
        return queryset.distinct()
    else:
        perm_ids = get_perm_ids_from_code_names(codenames)
        return queryset.filter(
            permissions__user=user,
            permissions__permission_id__in=perm_ids,
            permissions__deny=False,
        ).distinct()


@cache_for_request
def get_perm_ids_from_code_names(
    code_names: Union[str, list, tuple, set], model_: models.Model = None
) -> Union[int, list]:
    """
    Returns id or a list of ids corresponding to `code_names`.

    Args:
        code_names (str/list): Code name or list of code names
        model_: Any model of `settings.INSTALLED_APPS`. It's narrowed down to
                `Asset` by default.

    Returns:
        int/list: id or list of ids
    """
    # `get_cached_code_names` handles defaulting `model_` to `kpi.Asset`
    perm_ids = get_cached_code_names(model_)
    if isinstance(code_names, (list, tuple, set)):
        return [v['id'] for k, v in perm_ids.items() if k in code_names]
    else:
        return perm_ids[code_names]['id']


def get_user_permission_assignments(
    affected_object, user, object_permission_assignments
):
    """
    Works like `get_user_permission_assignments_queryset` but returns
    a list instead of a queryset. It also needs a list of all
    `affected_object`'s permission assignments to search for assignments
    `user` is allowed to see.

    Args:
        affected_object (Asset)
        user (User)
        object_permission_assignments (list):
    Returns:
         list

    """
    user_permission_assignments = []
    filtered_user_ids = None

    if not user or is_user_anonymous(user):
        filtered_user_ids = [affected_object.owner_id]
    elif not affected_object.has_perm(user, PERM_MANAGE_ASSET):
        # Display only users' permissions if they are not allowed to modify
        # others' permissions
        filtered_user_ids = [affected_object.owner_id,
                             user.pk,
                             settings.ANONYMOUS_USER_ID]

    for permission_assignment in object_permission_assignments:
        if (filtered_user_ids is None or
                permission_assignment.user_id in filtered_user_ids):
            user_permission_assignments.append(permission_assignment)

    return user_permission_assignments


def get_user_permission_assignments_queryset(affected_object, user):
    """
    Returns a queryset to fetch `affected_object`'s permission assignments
    that `user` is allowed to see.

    Args:
        affected_object (Asset)
        user (User)
    Returns:
        QuerySet

    """

    # `affected_object.permissions` is a `GenericRelation(ObjectPermission)`
    # Don't Prefetch `content_object`.
    # See `AssetPermissionAssignmentSerializer.to_representation()`
    queryset = affected_object.permissions.filter(deny=False).select_related(
        'permission', 'user'
    ).order_by(
        'user__username', 'permission__codename'
    ).exclude(permission__codename=PERM_FROM_KC_ONLY).all()

    # Filtering is done in `get_queryset` instead of FilteredBackend class
    # because it's specific to `ObjectPermission`.
    if not user or is_user_anonymous(user):
        queryset = queryset.filter(
            user_id__in=[
                affected_object.owner_id,
                settings.ANONYMOUS_USER_ID,
            ]
        )
    elif not affected_object.has_perm(user, PERM_MANAGE_ASSET):
        # Display only users' permissions if they are not allowed to modify
        # others' permissions
        queryset = queryset.filter(user_id__in=[user.pk,
                                                affected_object.owner_id,
                                                settings.ANONYMOUS_USER_ID])

    return queryset


def perm_parse(perm, obj=None):
    if obj is not None:
        obj_app_label = ContentType.objects.get_for_model(obj).app_label
    else:
        obj_app_label = None
    try:
        app_label, codename = perm.split('.', 1)
        if obj_app_label is not None and app_label != obj_app_label:
            raise serializers.ValidationError(
                'The given object does not belong to the app '
                'specified in the permission string.'
            )

    except ValueError:
        app_label = obj_app_label
        codename = perm
    return app_label, codename
