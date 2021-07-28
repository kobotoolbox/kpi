# coding: utf-8
import json
import logging

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, ProgrammingError, transaction
from rest_framework.authtoken.models import Token

from kpi.exceptions import KobocatProfileException
from kpi.utils.log import logging
from kpi.utils.permissions import is_user_anonymous
from .shadow_models import (
    safe_kc_read,
    KobocatContentType,
    KobocatDigestPartial,
    KobocatPermission,
    KobocatToken,
    KobocatUser,
    KobocatUserObjectPermission,
    KobocatUserPermission,
    KobocatUserProfile,
    KobocatXForm,
)


def _trigger_kc_profile_creation(user):
    """
    Get the user's profile via the KC API, causing KC to create a KC
    UserProfile if none exists already
    """
    url = settings.KOBOCAT_INTERNAL_URL + '/api/v1/user'
    token, _ = Token.objects.get_or_create(user=user)
    response = requests.get(
        url, headers={'Authorization': 'Token ' + token.key})
    if not response.status_code == 200:
        raise KobocatProfileException(
            'Bad HTTP status code `{}` when retrieving KoBoCAT user profile'
            ' for `{}`.'.format(response.status_code, user.username))
    return response


@safe_kc_read
def instance_count(xform_id_string, user_id):
    try:
        return KobocatXForm.objects.only('num_of_submissions').get(
            id_string=xform_id_string,
            user_id=user_id
        ).num_of_submissions
    except KobocatXForm.DoesNotExist:
        return 0


@safe_kc_read
def last_submission_time(xform_id_string, user_id):
    return KobocatXForm.objects.get(
        user_id=user_id, id_string=xform_id_string
    ).last_submission_time


@safe_kc_read
def get_kc_profile_data(user_id):
    """
    Retrieve all fields from the user's KC profile and  return them in a
    dictionary
    """
    try:
        profile_model = KobocatUserProfile.objects.get(user_id=user_id)
        # Use a dict instead of the object in case we enter the next exception.
        # The response will return a json.
        # We want the variable to have the same type in both cases.
        profile = profile_model.__dict__
    except KobocatUserProfile.DoesNotExist:
        try:
            response = _trigger_kc_profile_creation(User.objects.get(pk=user_id))
            profile = response.json()
        except KobocatProfileException:
            logging.exception('Failed to create KoBoCAT user profile')
            return {}

    fields = [
        # Use a (kc_name, new_name) tuple to rename a field
        'name',
        'organization',
        ('home_page', 'organization_website'),
        ('description', 'bio'),
        ('phonenumber', 'phone_number'),
        'address',
        'city',
        'country',
        'require_auth',
        'twitter',
        'metadata',
    ]

    result = {}

    for field in fields:

        if isinstance(field, tuple):
            kc_name, field = field
        else:
            kc_name = field

        value = profile.get(kc_name)
        # When a field contains JSON (e.g. `metadata`), it gets loaded as a
        # `dict`. Convert it back to a string representation
        if isinstance(value, dict):
            value = json.dumps(value)
        result[field] = value
    return result


def set_kc_require_auth(user_id, require_auth):
    """
    Configure whether or not authentication is required to see and submit data
    to a user's projects.
    WRITES to KobocatUserProfile.require_auth

    :param int user_id: ID/primary key of the :py:class:`User` object.
    :param bool require_auth: The desired setting.
    """
    user = User.objects.get(pk=user_id)
    _trigger_kc_profile_creation(user)
    token, _ = Token.objects.get_or_create(user=user)
    with transaction.atomic():
        try:
            profile = KobocatUserProfile.objects.get(user_id=user_id)
        except ProgrammingError as e:
            raise ProgrammingError('set_kc_require_auth error accessing '
                                   'kobocat tables: {}'.format(repr(e)))
        else:
            if profile.require_auth != require_auth:
                profile.require_auth = require_auth
                profile.save()


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
    permissions = KobocatPermission.objects.filter(
        codename__in=kc_codenames, **content_type_kwargs)
    return permissions


def _get_xform_id_for_asset(asset):
    if not asset.has_deployment:
        return None
    return asset.deployment.backend_response['formid']


def grant_kc_model_level_perms(user):
    """
    Gives `user` unrestricted model-level access to everything listed in
    settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES.  Without this, actions
    on individual instances are immediately denied and object-level permissions
    are never considered.
    """
    if not isinstance(user, KobocatUser):
        user = KobocatUser.objects.get(pk=user.pk)

    content_types = []
    for pair in settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES:
        try:
            content_types.append(
                KobocatContentType.objects.get(
                    app_label=pair[0],
                    model=pair[1]
                )
            )
        except KobocatContentType.DoesNotExist:
            # Consider raising `ImproperlyConfigured` here. Anyone running KPI
            # without KC should change
            # `KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES` appropriately in their
            # settings
            logging.error(
                'Could not find KoBoCAT content type for {}.{}'.format(*pair)
            )

    permissions_to_assign = KobocatPermission.objects.filter(
        content_type__in=content_types)

    if content_types and not permissions_to_assign.exists():
        raise RuntimeError(
            'No KoBoCAT permissions found! You may need to run the Django '
            'management command `migrate` in your KoBoCAT environment. '
            'Searched for content types {}.'.format(content_types)
        )

    # What KC permissions does this user already have? Getting the KC database
    # column names right necessitated a custom M2M model,
    # `KobocatUserPermission`, which means we can't use Django's tolerant
    # `add()`. Prior to Django 2.2, there's no way to make `bulk_create()`
    # ignore `IntegrityError`s, so we have to avoid duplication manually:
    # https://docs.djangoproject.com/en/2.2/ref/models/querysets/#django.db.models.query.QuerySet.bulk_create
    existing_user_perm_pks = KobocatUserPermission.objects.filter(
        user=user
    ).values_list('permission_id', flat=True)

    KobocatUserPermission.objects.bulk_create([
        KobocatUserPermission(user=user, permission=p)
        for p in permissions_to_assign if p.pk not in existing_user_perm_pks
    ])


def set_kc_anonymous_permissions_xform_flags(obj, kpi_codenames, xform_id,
                                             remove=False):
    r"""
        Given a KPI object, one or more KPI permission codenames and the PK of
        a KC `XForm`, assume the KPI permisisons have been assigned to or
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
    KobocatXForm.objects.filter(pk=xform_id).update(**xform_updates)


@transaction.atomic()
def assign_applicable_kc_permissions(obj, user, kpi_codenames):
    r"""
        Assign the `user` the applicable KC permissions to `obj`, if any
        exists, given one KPI permission codename as a single string or many
        codenames as an iterable. If `obj` is not a :py:class:`Asset` or does
        not have a deployment, take no action.
        :param obj: Any Django model instance
        :type user: :py:class:`User` or :py:class:`AnonymousUser`
        :type kpi_codenames: str or list(str)
    """
    if not obj._meta.model_name == 'asset':
        return
    permissions = _get_applicable_kc_permissions(obj, kpi_codenames)
    if not permissions:
        return
    xform_id = _get_xform_id_for_asset(obj)
    if not xform_id:
        return
    if is_user_anonymous(user):
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id)
    xform_content_type = KobocatContentType.objects.get(
        **obj.KC_CONTENT_TYPE_KWARGS)
    kc_permissions_already_assigned = KobocatUserObjectPermission.objects.filter(
        user=user, permission__in=permissions, object_pk=xform_id,
    ).values_list('permission__codename', flat=True)
    permissions_to_create = []
    for permission in permissions:
        if permission.codename in kc_permissions_already_assigned:
            continue
        permissions_to_create.append(KobocatUserObjectPermission(
            user=user, permission=permission, object_pk=xform_id,
            content_type=xform_content_type
        ))
    KobocatUserObjectPermission.objects.bulk_create(permissions_to_create)


@transaction.atomic()
def remove_applicable_kc_permissions(obj, user, kpi_codenames):
    r"""
        Remove the `user` the applicable KC permissions from `obj`, if any
        exists, given one KPI permission codename as a single string or many
        codenames as an iterable. If `obj` is not a :py:class:`Asset` or does
        not have a deployment, take no action.
        :param obj: Any Django model instance
        :type user: :py:class:`User` or :py:class:`AnonymousUser`
        :type kpi_codenames: str or list(str)
    """
    if not obj._meta.model_name == 'asset':
        return
    permissions = _get_applicable_kc_permissions(obj, kpi_codenames)
    if not permissions:
        return
    xform_id = _get_xform_id_for_asset(obj)
    if not xform_id:
        return
    if is_user_anonymous(user):
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id, remove=True)
    content_type_kwargs = _get_content_type_kwargs_for_related(obj)
    KobocatUserObjectPermission.objects.filter(
        user=user, permission__in=permissions, object_pk=xform_id,
        # `permission` has a FK to `ContentType`, but I'm paranoid
        **content_type_kwargs
    ).delete()


def delete_kc_users(deleted_pks: list) -> bool:
    """

    Args:
        deleted_pks: List of primary keys of KPI deleted objects

    Returns:
        bool: whether it has succeeded or not.
    """

    # Then, delete users in KoBoCAT database
    # Post signal is not triggered because the
    # deletion is made at the model level, not the object level
    kc_models = [
        KobocatDigestPartial,
        KobocatUserPermission,
        KobocatUserProfile,
        KobocatUserObjectPermission,
        KobocatToken,
    ]
    # We can delete related objects
    for kc_model in kc_models:
        kc_model.objects.filter(user_id__in=deleted_pks).delete()

    try:
        # If users have projects/submissions, this query should fail with
        # an `IntegrityError`.
        KobocatUser.objects.filter(id__in=deleted_pks).delete()
    except IntegrityError as e:
        logging.error(e)
        return False

    return True
