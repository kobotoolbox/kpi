from django.contrib import messages

from kpi.exceptions import (
    QueryParserBadSyntax,
    QueryParserNotSupportedFieldLookup,
    SearchQueryTooShortException,
)
from kpi.filters import SearchFilter


class AdvancedSearchMixin:

    class Media:
        js = ['admin/js/list_filter_toggle.js']

    def get_search_results(self, request, queryset, search_term):

        class _ViewAdminView:
            search_default_field_lookups = self.search_default_field_lookups

        use_distinct = True
        try:
            queryset = SearchFilter().filter_queryset(
                request, queryset, view=_ViewAdminView
            )
        except (
            QueryParserBadSyntax,
            QueryParserNotSupportedFieldLookup,
            SearchQueryTooShortException,
        ) as e:
            self.message_user(
                request,
                str(e),
                messages.ERROR,
            )
            return queryset.model.objects.none(), use_distinct

        return queryset, use_distinct
