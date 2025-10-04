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

    lookup_field_map = {}

    def get_object(self):
        queryset = self.get_queryset()
        queryset = self.filter_queryset(queryset)
        filter_kwargs = {}
        for field in self.lookup_fields:
            url_kwarg = self.lookup_field_map.get(field, field)
            try:
                filter_kwargs[field] = self.kwargs[url_kwarg]
            except KeyError:
                raise KeyError(
                    f"Expected URL kwarg '{url_kwarg}' for field '{field}' "  # noqa
                    f'was not found in kwargs: {self.kwargs}'
                )
        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj
