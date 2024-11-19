# coding: utf-8
from django.conf import settings
from django.contrib.auth.backends import ModelBackend as DjangoModelBackend
from django.contrib.auth.management import DEFAULT_DB_ALIAS

from .utils.database import get_thread_local
from .utils.object_permission import get_database_user
from .utils.permissions import is_user_anonymous


class ObjectPermissionBackend(DjangoModelBackend):
    def get_group_permissions(self, user_obj, obj=None):
        is_anonymous = is_user_anonymous(user_obj)
        user_obj = get_database_user(user_obj)
        permissions = super().get_group_permissions(user_obj, obj)
        if is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def get_all_permissions(self, user_obj, obj=None):
        is_anonymous = is_user_anonymous(user_obj)
        user_obj = get_database_user(user_obj)
        permissions = super().get_all_permissions(user_obj, obj)
        if is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def has_perm(self, user_obj, perm, obj=None):
        is_anonymous = is_user_anonymous(user_obj)
        user_obj = get_database_user(user_obj)
        if obj is None or not hasattr(obj, 'has_perm'):
            if is_anonymous:
                # Obey limits on anonymous users' permissions
                if perm not in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                    return False

            if hasattr(obj, 'has_mapped_perm'):
                if obj.has_mapped_perm(user_obj, perm):
                    return True

            return super().has_perm(user_obj, perm, obj)
        if not user_obj.is_active:
            # Inactive users are denied immediately
            return False
        # Trust the object-level test to handle anonymous users correctly
        return obj.has_perm(user_obj, perm)


class ModelBackend(DjangoModelBackend):

    def get_all_permissions(self, user_obj, obj=None):
        if not user_obj.is_active or user_obj.is_anonymous or obj is not None:
            return set()
        db_alias = get_thread_local('DB_ALIAS', DEFAULT_DB_ALIAS)
        cache_key = f'_perm_cache_{db_alias}'
        if not hasattr(user_obj, cache_key):
            setattr(user_obj, cache_key, {
                *self.get_user_permissions(user_obj),
                *self.get_group_permissions(user_obj),
            })
        return getattr(user_obj, cache_key)
