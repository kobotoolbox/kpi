from rest_framework.compat import get_model_name
from rest_framework import filters
from .models.object_permission import get_objects_for_user

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
        return get_objects_for_user(user, permission, queryset)

class ParentFilter(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        if 'parent' in request.query_params:
            if not request.query_params['parent']:
                # Query for null parent
                return queryset.filter(parent=None)
            else:
                # Query for a specific parent
                raise NotImplementedError()
        return queryset
