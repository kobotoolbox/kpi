# coding: utf-8
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.conf import settings

from .models.object_permission import get_database_user, perm_parse


class ObjectPermissionBackend(ModelBackend):
    def get_group_permissions(self, user_obj, obj=None):
        user_obj = get_database_user(user_obj)
        permissions = super().get_group_permissions(user_obj, obj)
        if user_obj.is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def get_all_permissions(self, user_obj, obj=None):
        user_obj = get_database_user(user_obj)
        permissions = super().get_all_permissions(user_obj, obj)
        if user_obj.is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def has_perm(self, user_obj, perm, obj=None):
        user_obj = get_database_user(user_obj)
        if obj is None or not hasattr(obj, 'has_perm'):
            if user_obj.is_anonymous:
                # Obey limits on anonymous users' permissions
                if perm not in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                    return False
            return super().has_perm(user_obj, perm, obj)
        if not user_obj.is_active:
            # Inactive users are denied immediately
            return False
        # Trust the object-level test to handle anonymous users correctly
        return obj.has_perm(user_obj, perm)

