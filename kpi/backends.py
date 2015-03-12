from django.contrib.auth.backends import ModelBackend

class TBDBackend(ModelBackend):
    def get_group_permissions(self, user_obj, obj=None):
        # probably won't be used
        return super(self, TBDBackend
            ).get_group_permissions(self, user_obj, obj=None)

    def get_all_permissions(self, user_obj, obj=None):
        return super(self, TBDBackend
            ).get_all_permissions(self, user_obj, obj=None)

    def has_perm(self, user_obj, obj=None):
        return super(self, TBDBackend
            ).has_perm(self, user_obj, obj=None)

    def has_module_perms(self, user_obj, app_label):
        # probably won't be used
        return super(self, TBDBackend
            ).has_module_perms(self, user_obj, app_label)

