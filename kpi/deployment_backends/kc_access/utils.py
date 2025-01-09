from contextlib import ContextDecorator
from typing import Union

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.db import ProgrammingError, transaction
from django.db.models import Model
from guardian.models import UserObjectPermission

from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.database import use_db
from kpi.utils.log import logging
from kpi.utils.permissions import is_user_anonymous


def safe_kc_read(func):
    def _wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ProgrammingError as e:
            raise ProgrammingError(
                'kc_access error accessing KoboCAT tables: {}'.format(str(e))
            )

    return _wrapper


def _get_content_type_kwargs_for_related(obj):
    r"""
        Given an `obj` with a `KC_CONTENT_TYPE_KWARGS` dictionary attribute,
        prepend `content_type__` to each key in that dictionary and return the
        result.
        :param obj: Object with `KC_CONTENT_TYPE_KWARGS` dictionary attribute
        :rtype dict(str, str)
    """
    try:
        content_type_kwargs = obj.KC_CONTENT_TYPE_KWARGS
    except AttributeError:
        raise ImproperlyConfigured(
            'Model {} has a KC_PERMISSIONS_MAP attribute but lacks '
            'KC_CONTENT_TYPE_KWARGS'.format(obj._meta.model_name)
        )
    # Prepend 'content_type__' to each field name in KC_CONTENT_TYPE_KWARGS
    content_type_kwargs = {
        'content_type__' + k: v for k, v in content_type_kwargs.items()
    }
    return content_type_kwargs


def _get_applicable_kc_permissions(obj, kpi_codenames):
    r"""
        Given a KPI object and one KPI permission codename as a single string,
        or many codenames as an iterable, return the corresponding KC
        permissions as a list of `KobocatPermission` objects.
        :param obj: Object with `KC_PERMISSIONS_MAP` dictionary attribute
        :param kpi_codenames: One or more codenames for KPI permissions
        :type kpi_codenames: str or list(str)
        :rtype list(:py:class:`Permission`)
    """
    if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
        return []
    try:
        perm_map = obj.KC_PERMISSIONS_MAP
    except AttributeError:
        # This model doesn't have any associated KC permissions
        logging.warning(
            '{} object missing KC_PERMISSIONS_MAP'.format(type(obj)))
        return []
    if isinstance(kpi_codenames, str):
        kpi_codenames = [kpi_codenames]
    # Map KPI codenames to KC
    kc_codenames = []
    for kpi_codename in kpi_codenames:
        try:
            kc_codenames.append(perm_map[kpi_codename])
        except KeyError:
            # This permission doesn't map to anything in KC
            continue
    content_type_kwargs = _get_content_type_kwargs_for_related(obj)
    permissions = Permission.objects.using(settings.OPENROSA_DB_ALIAS).filter(
        codename__in=kc_codenames, **content_type_kwargs
    )
    return permissions


def _get_xform_id_for_asset(asset):
    if not asset.has_deployment:
        return None
    try:
        return asset.deployment.backend_response['formid']
    except KeyError:
        if settings.TESTING:
            return None
        raise


def grant_kc_model_level_perms(user: 'kobo_auth.User'):
    """
    Gives `user` unrestricted model-level access to everything listed in
    settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES.  Without this, actions
    on individual instances are immediately denied and object-level permissions
    are never considered.
    """
    content_types = []
    for pair in settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES:
        try:
            content_types.append(
                ContentType.objects.using(settings.OPENROSA_DB_ALIAS).get(
                    app_label=pair[0],
                    model=pair[1]
                )
            )
        except ContentType.DoesNotExist:
            # Consider raising `ImproperlyConfigured` here. Anyone running KPI
            # without KC should change
            # `KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES` appropriately in their
            # settings
            logging.error('Could not find KoboCAT content type for {}.{}'.format(*pair))

    permissions_to_assign = Permission.objects.using(settings.OPENROSA_DB_ALIAS).filter(
        content_type__in=content_types
    )

    if content_types and not permissions_to_assign.exists():
        raise RuntimeError(
            'No KoboCAT permissions found! You may need to run the Django '
            'management command `migrate` in your KoboCAT environment. '
            'Searched for content types {}.'.format(content_types)
        )

    with use_db(settings.OPENROSA_DB_ALIAS):
        user.user_permissions.add(*permissions_to_assign)


def set_kc_anonymous_permissions_xform_flags(
    obj, kpi_codenames, xform_id, remove=False
):
    r"""
    Given a KPI object, one or more KPI permission codenames and the PK of
    a KC `XForm`, assume the KPI permissions have been assigned to or
    removed from the anonymous user. Then, modify any corresponding flags
    on the `XForm` accordingly.
    :param obj: Object with `KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS`
        dictionary attribute
    :param kpi_codenames: One or more codenames for KPI permissions
    :type kpi_codenames: str or list(str)
    :param xform_id: PK of the KC `XForm` associated with `obj`
    :param remove: If `True`, apply the Boolean `not` operator to each
        value in `KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS`
    """
    if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
        return
    try:
        perms_to_flags = obj.KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS
    except AttributeError:
        logging.warning(
            '{} object missing KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS'.format(
                type(obj)))
        return
    if isinstance(kpi_codenames, str):
        kpi_codenames = [kpi_codenames]
    # Find which KC `XForm` flags need to be switched
    xform_updates = {}
    for kpi_codename in kpi_codenames:
        try:
            flags = perms_to_flags[kpi_codename]
        except KeyError:
            # This permission doesn't map to anything in KC
            continue
        if remove:
            flags = {flag: not value for flag, value in flags.items()}
        xform_updates.update(flags)

    # Write to the KC database
    XForm = obj.deployment.xform.__class__  # noqa - avoid circular imports
    XForm.objects.filter(pk=xform_id).update(**xform_updates)


def assign_applicable_kc_permissions(
    obj: Model,
    user: Union[AnonymousUser, User, int],
    kpi_codenames: Union[str, list]
):
    """
    Assign the `user` the applicable KC permissions to `obj`, if any
    exists, given one KPI permission codename as a single string or many
    codenames as an iterable. If `obj` is not a :py:class:`Asset` or does
    not have a deployment, take no action.
    """
    if not obj._meta.model_name == 'asset':
        return
    permissions = _get_applicable_kc_permissions(obj, kpi_codenames)
    if not permissions:
        return
    xform_id = _get_xform_id_for_asset(obj)
    if not xform_id:
        return

    # Retrieve primary key from user object and use it on subsequent queryset.
    # It avoids loading the object when `user` is passed as an integer.
    if not isinstance(user, int):
        if is_user_anonymous(user):
            user_id = settings.ANONYMOUS_USER_ID
        else:
            user_id = user.pk
    else:
        user_id = user

    if user_id == settings.ANONYMOUS_USER_ID:
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id
        )

    xform_content_type = ContentType.objects.using(settings.OPENROSA_DB_ALIAS).get(
        **obj.KC_CONTENT_TYPE_KWARGS
    )

    kc_permissions_already_assigned = (
        UserObjectPermission.objects.using(settings.OPENROSA_DB_ALIAS)
        .filter(
            user_id=user_id,
            permission__in=permissions,
            object_pk=xform_id,
        )
        .values_list('permission__codename', flat=True)
    )
    permissions_to_create = []
    for permission in permissions:
        if permission.codename in kc_permissions_already_assigned:
            continue
        permissions_to_create.append(
            UserObjectPermission(
                user_id=user_id,
                permission=permission,
                object_pk=xform_id,
                content_type=xform_content_type,
            )
        )
    UserObjectPermission.objects.using(settings.OPENROSA_DB_ALIAS).bulk_create(
        permissions_to_create
    )


def remove_applicable_kc_permissions(
    obj: Model,
    user: Union[AnonymousUser, User, int],
    kpi_codenames: Union[str, list]
):
    """
    Remove the `user` the applicable KC permissions from `obj`, if any
    exists, given one KPI permission codename as a single string or many
    codenames as an iterable. If `obj` is not a :py:class:`Asset` or does
    not have a deployment, take no action.
    """

    if not obj._meta.model_name == 'asset':
        return
    permissions = _get_applicable_kc_permissions(obj, kpi_codenames)
    if not permissions:
        return
    xform_id = _get_xform_id_for_asset(obj)
    if not xform_id:
        return

    # Retrieve primary key from user object and use it on subsequent queryset.
    # It avoids loading the object when `user` is passed as an integer.
    if not isinstance(user, int):
        if is_user_anonymous(user):
            user_id = settings.ANONYMOUS_USER_ID
        else:
            user_id = user.pk
    else:
        user_id = user

    if user_id == settings.ANONYMOUS_USER_ID:
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id, remove=True
        )

    content_type_kwargs = _get_content_type_kwargs_for_related(obj)
    UserObjectPermission.objects.using(settings.OPENROSA_DB_ALIAS).filter(
        user_id=user_id, permission__in=permissions, object_pk=xform_id,
        # `permission` has a FK to `ContentType`, but I'm paranoid
        **content_type_kwargs
    ).delete()


def reset_kc_permissions(
    obj: Model,
    user: Union[AnonymousUser, User, int],
):
    """
    Remove the `user` all KC permissions from `obj`, if any
    exists.
    This should not called without a subsequent call of
    `assign_applicable_kc_permissions()`
    """

    if not obj._meta.model_name == 'asset':
        return
    xform_id = _get_xform_id_for_asset(obj)
    if not xform_id:
        return

    # Retrieve primary key from user object and use it on subsequent queryset.
    # It avoids loading the object when `user` is passed as an integer.
    if not isinstance(user, int):
        if is_user_anonymous(user):
            user_id = settings.ANONYMOUS_USER_ID
        else:
            user_id = user.pk
    else:
        user_id = user

    if user_id == settings.ANONYMOUS_USER_ID:
        raise NotImplementedError

    content_type_kwargs = _get_content_type_kwargs_for_related(obj)
    UserObjectPermission.objects.using(settings.OPENROSA_DB_ALIAS).filter(
        user_id=user_id,
        object_pk=xform_id,
        # `permission` has a FK to `ContentType`, but I'm paranoid
        **content_type_kwargs
    ).delete()


def delete_kc_user(username: str):
    with use_db(settings.OPENROSA_DB_ALIAS):
        # Do not use `.using()` here because it does not bubble down to the
        # Collector.
        User.objects.filter(username=username).delete()


def kc_transaction_atomic(using=settings.OPENROSA_DB_ALIAS, *args, **kwargs):
    """
    KoboCAT database does not exist in testing environment.
    `transaction.atomic(using='kobocat') cannot be called without raising errors.

    This utility returns a context manager which does nothing if environment
    is set to `TESTING`. Otherwise, it returns a real context manager which
    provides transactions support.
    """
    class DummyAtomic(ContextDecorator):
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            pass

        def __exit__(self, exc_type, exc_value, traceback):
            pass

    assert (
        callable(using) or using == settings.OPENROSA_DB_ALIAS
    ), "`kc_transaction_atomic` may only be used with the 'kobocat' database"

    if settings.TESTING:
        # Bare decorator: @atomic -- although the first argument is called
        # `using`, it's actually the function being decorated.
        if callable(using):
            return DummyAtomic()(using)
        else:
            return DummyAtomic()

    # Not in a testing environment; use the real `atomic`
    if callable(using):
        return transaction.atomic(settings.OPENROSA_DB_ALIAS, *args, **kwargs)(using)
    else:
        return transaction.atomic(settings.OPENROSA_DB_ALIAS, *args, **kwargs)
