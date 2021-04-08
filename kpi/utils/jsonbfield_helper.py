# coding: utf-8
import json

from django.db.models.expressions import Func


class ReplaceValues(Func):
    """
    Updates several properties at once of a JSONBField without overwriting the
    whole document.
    Avoids race conditions when document is saved in two different transactions
    at the same time. (i.e.: `Asset._deployment['status']`)

    https://www.postgresql.org/docs/current/functions-json.html
    """
    function = 'jsonb_set'
    template = "%(expressions)s || '%(updates)s'"
    arity = 1

    def __init__(
        self,
        expression: str,
        updates: dict,
        **extra,
    ):
        super().__init__(
            expression,
            updates=json.dumps(updates),
            **extra,
        )
