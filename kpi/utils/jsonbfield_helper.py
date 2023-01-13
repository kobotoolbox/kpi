# coding: utf-8
import json

from django.db.models import Lookup, Field
from django.db.models.expressions import Func, Value


@Field.register_lookup
class InArray(Lookup):

    lookup_name = 'in_array'
    prepare_rhs = False

    def as_sql(self, compiler, connection):
        lhs, lhs_params = self.process_lhs(compiler, connection)
        rhs, rhs_params = self.process_rhs(compiler, connection)
        params = lhs_params + tuple(rhs_params)
        return '%s ?| %s' % (lhs, rhs), params


class ReplaceValues(Func):
    """
    Updates several properties at once of a models.JSONField without overwriting the
    whole document.
    Avoids race conditions when document is saved in two different transactions
    at the same time. (i.e.: `Asset._deployment['status']`)
    https://www.postgresql.org/docs/current/functions-json.html

    Notes from postgres docs:
    > Does not operate recursively: only the top-level array or object
    > structure is merged
    """
    arg_joiner = ' || '
    template = "%(expressions)s"
    arity = 2

    def __init__(
        self,
        expression: str,
        updates: dict,
        **extra,
    ):
        super().__init__(
            expression,
            Value(json.dumps(updates)),
            **extra,
        )
