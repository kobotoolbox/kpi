from django.shortcuts import get_object_or_404


# https://www.django-rest-framework.org/api-guide/generic-views/#creating-custom-mixins
class MultipleFieldLookupMixin:
    """
    Apply this mixin to any view or viewset to enable multi-field lookups
    based on a `lookup_fields` attribute, instead of the default single-field lookup
    (`lookup_field`).

    ⚠️ Warning:
    Make sure to declare the route using `.as_view()` so that `lookup_value_regex` is
    properly applied. Avoid using DRF's automatic routers, which rely on the default
    `lookup_field = 'pk'`.
    """

    def get_object(self):
        queryset = self.get_queryset()
        queryset = self.filter_queryset(queryset)
        filter = {}
        for field in self.lookup_fields:
            filter[field] = self.kwargs[field]
        obj = get_object_or_404(queryset, **filter)
        self.check_object_permissions(self.request, obj)
        return obj
