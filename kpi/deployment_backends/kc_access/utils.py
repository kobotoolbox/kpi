from contextlib import contextmanager

from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.db import ProgrammingError, transaction

from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.database import use_db
from kpi.utils.log import logging


def safe_kc_read(func):
    def _wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ProgrammingError as e:
            raise ProgrammingError(
                'kc_access error accessing KoboCAT tables: {}'.format(str(e))
            )

    return _wrapper


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
    obj, kpi_codenames, remove=False
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
    xform_id = _get_xform_id_for_asset(obj)

    if xform_id is None:
        return
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


def delete_kc_user(username: str):
    if settings.TESTING:
        return

    with use_db(settings.OPENROSA_DB_ALIAS):
        # Do not use `.using()` here because it does not bubble down to the
        # Collector.
        User.objects.filter(username=username).delete()


@contextmanager
def conditional_kc_transaction_atomic(
    using=settings.OPENROSA_DB_ALIAS, *args, **kwargs
):
    connection = transaction.get_connection(using=using)
    if connection.in_atomic_block:
        yield
    else:
        with kc_transaction_atomic(using=using):
            yield


def kc_transaction_atomic(using=settings.OPENROSA_DB_ALIAS, *args, **kwargs):
    """
    Context manager that wraps code in a database transaction for the KoboCAT database,
    with special handling in testing environments.

    In normal usage, this behaves like `transaction.atomic(using='kobocat')`.

    However, when `settings.TESTING` is True, the database alias is forcibly overridden
    to use the default database instead of 'kobocat'. This avoids errors during testing
    when the KoboCAT database is not available.

    Note: Only allowed with the 'kobocat' alias; using any other alias will raise an
    error.
    """

    assert (
        callable(using) or using == settings.OPENROSA_DB_ALIAS
    ), "`kc_transaction_atomic` may only be used with the 'kobocat' database"

    db_alias = (
        settings.DEFAULT_DB_ALIAS if settings.TESTING else settings.OPENROSA_DB_ALIAS
    )

    # Bare decorator: @atomic -- although the first argument is called
    # `using`, it's actually the function being decorated.
    if callable(using):
        return transaction.atomic(db_alias, *args, **kwargs)(using)
    else:
        return transaction.atomic(db_alias, *args, **kwargs)
