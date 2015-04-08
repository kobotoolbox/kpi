from rest_framework.compat import get_model_name
# from .models import object_permission

class KpiObjectPermissionsFilter(object):
    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):
        user = request.user
        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': get_model_name(model_cls)
        }
        permission = self.perm_format % kwargs
        raise NotImplementedError("womp womp")
        # return kpi.get_objects_for_user(user, permission, queryset)
