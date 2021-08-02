# coding: utf-8
from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q

"""
`import`s inside functions are there to avoid circular dependencies. They
shouldn't incur a penalty:

    [T]he VM maintains a list of modules that have already been imported, and
    any subsequent attempts to import that module result in a quick dict lookup
    in sys.modules and nothing else. (https://stackoverflow.com/a/4177780)
"""


def grant_default_model_level_perms(user):
    """
    Gives `user` unrestricted model-level access to Assets.
    Without this, actions on individual instances are immediately denied and
    object-level permissions are never considered.
    """
    from kpi.models import Asset

    grant_all_model_level_perms(user, models_or_content_types=[Asset])


def grant_all_model_level_perms(
        user, models_or_content_types, permissions_manager=Permission.objects,
        content_type_manager=ContentType.objects):
    """
    Utility function that gives `user` unrestricted model-level access
    to everything listed in `models_or_content_types`. Without this, actions on
    individual instances are immediately denied and object-level permissions
    are never considered.

    Args:
        user (instance of User model)
        models_or_content_types (django.db.models.Model,
            django.contrib.contenttypes.models.ContentType, or iterable of
            either)
        permissions_manager (django.db.models.Manager)
        content_type_manager (django.db.models.Manager)
    """
    from kpi.utils.object_permission import perm_parse

    try:
        iter(models_or_content_types)
    except TypeError:
        # models_or_content_types is a single item, not an iterable
        models_or_content_types = [models_or_content_types]

    content_types = []
    for item in models_or_content_types:
        if isinstance(item, content_type_manager.model):
            content_types.append(item)
        else:
            content_types.append(content_type_manager.get_for_model(item))

    permissions_to_assign = permissions_manager.filter(
        content_type__in=content_types)

    if content_types and not permissions_to_assign.exists():
        raise Exception('No permissions found! You may need to migrate your '
                        'database. Searched for content types {}.'.format(
                            content_types))

    if user.pk == settings.ANONYMOUS_USER_ID:
        # The user is anonymous, so pare down the permissions to only those
        # that the configuration allows for anonymous users
        q_query = Q()
        for allowed_permission in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
            app_label, codename = perm_parse(allowed_permission)
            q_query |= Q(content_type__app_label=app_label, codename=codename)
        permissions_to_assign = permissions_to_assign.filter(q_query)

    user.user_permissions.add(*permissions_to_assign)


def is_user_anonymous(user):
    return user.is_anonymous or user.pk == settings.ANONYMOUS_USER_ID


