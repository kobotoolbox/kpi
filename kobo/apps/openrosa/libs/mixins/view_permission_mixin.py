# coding: utf-8
from django.core.exceptions import ImproperlyConfigured
from kobo.apps.openrosa.libs.utils.guardian import get_objects_for_user


class ViewPermissionMixin:

    def get_queryset(self):
        """
        Get the list of items for this view
        based on user's view_%(model_name)s permissions.
        """

        # Sometime there is no model object
        model = getattr(self, 'model', None)
        self.model = model or getattr(self.queryset, 'model', None)

        if self.request is not None and self.model is not None:
            kwargs = {
                'app_label': self.model._meta.app_label,
                # module_name is now named model_name in django 1.8
                'model_name': self.model._meta.model_name
            }
            perms = ['%(app_label)s.view_%(model_name)s' % kwargs]
            return get_objects_for_user(self.request.user, perms, self.model)

        if self.model is not None:
            return self.model._default_manager.all()

        raise ImproperlyConfigured("'%s' must define 'queryset' or 'model'"
                                   % self.__class__.__name__)
