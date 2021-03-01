# coding: utf-8
from django.db.models import QuerySet

# This file stores evil hacks so that they're kept in a single place and easy
# to search out and destroy when that becomes possible

def clear_filtering(queryset: QuerySet) -> QuerySet:
    """
    Remove the WHERE clause from a QuerySet by poking undocumented Django
    dragons. Used when other aspects of the QuerySet need to be kept, e.g.
    ordering and annotations
    """
    # Copy to a new QuerySet; don't touch the original
    clone = queryset.all()
    # Life is for the living
    clone.query.where = type(clone.query.where)()
    return clone
