# coding: utf-8
from django.db.models import TextField
from django.db.models.functions import Cast
from django.db.models.query import QuerySet
from rest_framework.request import Request

from kpi.model_utils import remove_string_prefix

def filter_export_tasks(request: Request, queryset: QuerySet) -> QuerySet:
    # Ultra-basic filtering by:
    # * source URL or UID if `q=source:[URL|UID]` was provided;
    # * comma-separated list of `ExportTask` UIDs if
    #   `q=uid__in:[UID],[UID],...` was provided
    q = request.query_params.get('q', False)
    if not q:
        # No filter requested
        return queryset
    if q.startswith('source:'):
        q = remove_string_prefix(q, 'source:')
        # Crude, but `data__source` is a URL. Cast `data__source` to a
        # `TextField` to avoid the special behavior of `__contains` for
        # `JSONField`s. See
        # https://docs.djangoproject.com/en/2.2/ref/contrib/postgres/fields/#std:fieldlookup-hstorefield.contains
        queryset = queryset.annotate(
            source_str=Cast('data__source', output_field=TextField())
        ).filter(source_str__contains=q)
    elif q.startswith('uid__in:'):
        q = remove_string_prefix(q, 'uid__in:')
        uids = [uid.strip() for uid in q.split(',')]
        queryset = queryset.filter(uid__in=uids)
    else:
        # Filter requested that we don't understand; make it obvious by
        # returning nothing
        return ExportTask.objects.none()
    return queryset

def format_exception_values(values: list, sep: str = 'or') -> str:
    return "{} {} '{}'".format(
        ', '.join([f"'{v}'" for v in values[:-1]]), sep, values[-1]
    )

