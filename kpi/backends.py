# coding: utf-8
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.conf import settings

from kpi.utils.object_permission import get_anonymous_user


class ObjectPermissionBackend(ModelBackend):
    @staticmethod
    def _translate_anonymous_user(user_obj):
        """
        Returns user_obj, is_anonymous, where user_obj is always a real
        User object (translated from AnonymousUser if necessary), and
        is_anonymous is True if the user is anonymous
        """
        is_anonymous = False
        if isinstance(user_obj, AnonymousUser):
            is_anonymous = True
            user_obj = get_anonymous_user()
        elif user_obj.pk == settings.ANONYMOUS_USER_ID:
            is_anonymous = True
        return user_obj, is_anonymous

    def get_group_permissions(self, user_obj, obj=None):
        user_obj, is_anonymous = self._translate_anonymous_user(user_obj)
        permissions = super().get_group_permissions(user_obj, obj)
        if is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def get_all_permissions(self, user_obj, obj=None):
        user_obj, is_anonymous = self._translate_anonymous_user(user_obj)
        permissions = super().get_all_permissions(user_obj, obj)
        if is_anonymous:
            # Obey limits on anonymous users' permissions
            allowed_set = set(settings.ALLOWED_ANONYMOUS_PERMISSIONS)
            return permissions.intersection(allowed_set)
        else:
            return permissions

    def has_perm(self, user_obj, perm, obj=None):
        user_obj, is_anonymous = self._translate_anonymous_user(user_obj)
        if obj is None or not hasattr(obj, 'has_perm'):
            if is_anonymous:
                # Obey limits on anonymous users' permissions
                if perm not in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
                    return False
            return super().has_perm(user_obj, perm, obj)
        if not user_obj.is_active:
            # Inactive users are denied immediately
            return False
        # Trust the object-level test to handle anonymous users correctly
        return obj.has_perm(user_obj, perm)

