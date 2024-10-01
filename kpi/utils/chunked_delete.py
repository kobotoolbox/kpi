from django.db.models import QuerySet


def chunked_delete(queryset: QuerySet):
    while True:
        count, _ = queryset.filter(pk__in=queryset[:1000]).delete()
        if not count:
            break
