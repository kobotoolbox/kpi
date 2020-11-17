# coding: utf-8
from django.db.models.expressions import Func


class ReplaceValue(Func):
    """
    Updates a property of a JSONBField without overwriting the whole document.
    Avoids race conditions when document is saved in two different transactions
    at the same time. (i.e.: `Asset._deployment['status']`)

    Credits to https://stackoverflow.com/a/45308014/1141214
    """
    function = 'jsonb_set'
    template = (
        "%(function)s(%(expressions)s, '{\"%(key_name)s\"}',"
        "'\"%(new_value)s\"', %(create_missing)s)"
    )
    arity = 1

    def __init__(
        self,
        expression: str,
        key_name: str,
        new_value: str,
        create_missing: bool = True,
        **extra,
    ):
        super().__init__(
            expression,
            key_name=key_name,
            new_value=new_value,
            create_missing='true' if create_missing else 'false',
            **extra,
        )
