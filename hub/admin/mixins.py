from django.contrib import messages

from kpi.exceptions import (
    QueryParserBadSyntax,
    QueryParserNotSupportedFieldLookup,
    QueryParserTooManyRelationalFilters,
    SearchQueryTooShortException,
)
from kpi.filters import SearchFilter


class AdvancedSearchMixin:

    # Whether search results skip de-duplication. The name is the one that
    # `SearchFilter` reads on DRF views. When True, two things are skipped:
    #   - the `.distinct()` that `SearchFilter` adds to the filtered queryset;
    #   - the `EXISTS` subquery that the changelist wraps around the results
    #     when `get_search_results()` says they may hold duplicates.
    # On a large table, both read every row, even to display one page.
    # Set it to True only on admins whose searches follow single-valued
    # relations (foreign keys, one-to-one), which cannot return the same
    # object twice. A search that follows a to-many relation anyway may then
    # list an object more than once.
    skip_distinct = False

    class Media:
        js = ['admin/js/list_filter_toggle.js']

    def get_search_results(self, request, queryset, search_term):

        # Stands in for the DRF view that `SearchFilter` expects
        class _ViewAdminView:
            search_default_field_lookups = self.search_default_field_lookups
            # Skips the `.distinct()` of `SearchFilter`
            skip_distinct = self.skip_distinct

        # Second value returned to the changelist. When True, Django removes
        # duplicates with `root_queryset.filter(Exists(...))`, a subquery that
        # reads the whole table. False skips it (see `skip_distinct`)
        may_have_duplicates = not self.skip_distinct
        try:
            queryset = SearchFilter().filter_queryset(
                request, queryset, view=_ViewAdminView
            )
        except (
            QueryParserBadSyntax,
            QueryParserNotSupportedFieldLookup,
            QueryParserTooManyRelationalFilters,
            SearchQueryTooShortException,
        ) as e:
            self.message_user(
                request,
                str(e),
                messages.ERROR,
            )
            return queryset.model.objects.none(), may_have_duplicates

        return queryset, may_have_duplicates
