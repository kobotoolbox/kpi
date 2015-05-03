from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from .models.object_permission import get_anonymous_user

class ObjectPermissionBackend(ModelBackend):
    def get_group_permissions(self, user_obj, obj=None):
        # probably won't be used
        return super(ObjectPermissionBackend, self
            ).get_group_permissions(user_obj, obj)

    def get_all_permissions(self, user_obj, obj=None):
        return super(ObjectPermissionBackend, self
            ).get_all_permissions(user_obj, obj)

    def has_perm(self, user_obj, perm, obj=None):
        if isinstance(user_obj, AnonymousUser):
            # Get the User database representation for AnonymousUser
            # BEFORE we call the superclass' method
            user_obj = get_anonymous_user()
        if obj is None or not hasattr(obj, 'has_perm'):
            return super(ObjectPermissionBackend, self
                ).has_perm(user_obj, perm, obj)
        if not user_obj.is_active:
            # Inactive users are denied immediately
            return False
        return obj.has_perm(user_obj, perm)

    def has_module_perms(self, user_obj, app_label):
        # probably won't be used
        return super(ObjectPermissionBackend, self
            ).has_module_perms(user_obj, app_label)

