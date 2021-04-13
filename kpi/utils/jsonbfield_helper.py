# coding: utf-8
import json


from django.db.models.expressions import Func, Value


class ReplaceValues(Func):
    """
    Updates several properties at once of a JSONBField without overwriting the
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
