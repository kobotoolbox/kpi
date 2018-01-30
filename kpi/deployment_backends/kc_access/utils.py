import logging
import json
import logging
from collections import Iterable

from django.conf import settings
from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.checks import Warning, register as register_check
from django.db import ProgrammingError, transaction
from guardian.models import UserObjectPermission
from rest_framework.authtoken.models import Token
import requests

from .shadow_models import _models, safe_kc_read


class _KoboCatProfileException(Exception):
    pass

def _trigger_kc_profile_creation(user):
    '''
    Get the user's profile via the KC API, causing KC to create a KC
    UserProfile if none exists already
    '''
    url = settings.KOBOCAT_URL + '/api/v1/user'
    token, _ = Token.objects.get_or_create(user=user)
    response = requests.get(
        url, headers={'Authorization': 'Token ' + token.key})
    if not response.status_code == 200:
        raise _KoboCatProfileException(
            'Bad HTTP status code `{}` when retrieving KoBoCAT user profile'
            ' for `{}`.'.format(response.status_code, user.username))
    return response

@safe_kc_read
def instance_count(xform_id_string, user_id):
    return _models.Instance.objects.filter(deleted_at__isnull=True,
                                           xform__user_id=user_id,
                                           xform__id_string=xform_id_string,
                                           ).count()

@safe_kc_read
def last_submission_time(xform_id_string, user_id):
    return _models.XForm.objects.get(
        user_id=user_id, id_string=xform_id_string
    ).last_submission_time

@safe_kc_read
def get_kc_profile_data(user_id):
    '''
    Retrieve all fields from the user's KC profile and  return them in a
    dictionary
    '''
    try:
        profile = _models.UserProfile.objects.get(user_id=user_id)
    except _models.UserProfile.DoesNotExist:
        try:
            _trigger_kc_profile_creation(User.objects.get(pk=user_id))
        except _KoboCatProfileException:
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
        value = getattr(profile, kc_name)
        # When a field contains JSON (e.g. `metadata`), it gets loaded as a
        # `dict`. Convert it back to a string representation
        if isinstance(value, dict):
            value = json.dumps(value)
        result[field] = value
    return result


def set_kc_require_auth(user_id, require_auth):
    '''
    Configure whether or not authentication is required to see and submit data
    to a user's projects.
    WRITES to KC's UserProfile.require_auth

    :param int user_id: ID/primary key of the :py:class:`User` object.
    :param bool require_auth: The desired setting.
    '''
    user = User.objects.get(pk=user_id)
    _trigger_kc_profile_creation(user)
    token, _ = Token.objects.get_or_create(user=user)
    with transaction.atomic():
        try:
            profile = _models.UserProfile.objects.get(user_id=user_id)
        except ProgrammingError as e:
            raise ProgrammingError(u'set_kc_require_auth error accessing '
                                   u'kobocat tables: {}'.format(repr(e)))
        else:
            if profile.require_auth != require_auth:
                profile.require_auth = require_auth
                profile.save()


def _get_content_type_kwargs(obj):
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
        'content_type__' + k: v for k, v in content_type_kwargs.iteritems()
    }
    return content_type_kwargs


def _get_applicable_kc_permissions(obj, kpi_codenames):
    r"""
        Given a KPI object and one KPI permission codename as a single string,
        or many codenames as an iterable, return the corresponding KC
        permissions as a list of `Permission` objects.
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
    if isinstance(kpi_codenames, basestring):
        kpi_codenames = [kpi_codenames]
    # Map KPI codenames to KC
    kc_codenames = []
    for kpi_codename in kpi_codenames:
        try:
            kc_codenames.append(perm_map[kpi_codename])
        except KeyError:
            # This permission doesn't map to anything in KC
            continue
    content_type_kwargs = _get_content_type_kwargs(obj)
    permissions = Permission.objects.filter(
        codename__in=kc_codenames, **content_type_kwargs)
    return permissions


def _get_xform_id_for_asset(asset):
    if not asset.has_deployment:
        return None
    return asset.deployment.backend_response['formid']

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
    if isinstance(kpi_codenames, basestring):
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
            flags = {flag: not value for flag, value in flags.iteritems()}
        xform_updates.update(flags)
    # Write to the KC database
    _models.XForm.objects.filter(pk=xform_id).update(**xform_updates)

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
    if user.is_anonymous() or user.pk == settings.ANONYMOUS_USER_ID:
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id)
    xform_content_type = ContentType.objects.get(**obj.KC_CONTENT_TYPE_KWARGS)
    kc_permissions_already_assigned = UserObjectPermission.objects.filter(
        user=user, permission__in=permissions, object_pk=xform_id,
    ).values_list('permission__codename', flat=True)
    permissions_to_create = []
    for permission in permissions:
        # Since `logger` isn't in `INSTALLED_APPS`, `get_or_create()` raises
        # `AttributeError: 'NoneType' object has no attribute '_base_manager'`.
        # We hack around this with `bulk_create()`, which bypasses
        # `UserObjectPermission.save()`
        if permission.codename in kc_permissions_already_assigned:
            continue
        permissions_to_create.append(UserObjectPermission(
            user=user, permission=permission, object_pk=xform_id,
            content_type=xform_content_type
        ))
    UserObjectPermission.objects.bulk_create(permissions_to_create)


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
    if user.is_anonymous() or user.pk == settings.ANONYMOUS_USER_ID:
        return set_kc_anonymous_permissions_xform_flags(
            obj, kpi_codenames, xform_id, remove=True)
    content_type_kwargs = _get_content_type_kwargs(obj)
    # Do NOT try to `print` or do anything else that would `repr()` this
    # queryset, or you'll be greeted by
    # `AttributeError: 'NoneType' object has no attribute '_base_manager'`
    UserObjectPermission.objects.filter(
        user=user, permission__in=permissions, object_pk=xform_id,
        # `permission` has a FK to `ContentType`, but I'm paranoid
        **content_type_kwargs
    ).delete()


@register_check()
def guardian_message(app_configs, **kwargs):
    r"""
        Including `guardian` in `INSTALLED_APPS` but not using its
        authentication backend causes Guardian to raise a warning through the
        Django system check framework. Here we raise our own warning
        instructing the administrator to ignore Guardian's warning.
    """
    return [
        Warning(
            '*** Please disregard warning guardian.W001. ***',
            id='guardian.W001'
        )
    ]
