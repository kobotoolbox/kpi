from __future__ import annotations

import json

from django.db.models import Field, Lookup
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


class IncrementValue(Func):

    function = 'jsonb_set'
    template = (
        "%(function)s(%(expressions)s,"
        "'{\"%(keyname)s\"}',"
        "(COALESCE(%(expressions)s ->> '%(keyname)s', '0')::int "
        "+ %(increment)s)::text::jsonb)"
    )
    arity = 1

    def __init__(self, expression: str, keyname: str, increment: int, **extra):
        super().__init__(
            expression,
            keyname=keyname,
            increment=increment,
            **extra,
        )


class DeductUsageValue(Func):

    function = 'jsonb_set'
    usage_value = "COALESCE(%(expressions)s ->> '%(keyname)s', '0')::int"
    template = (
        '%(function)s(%(expressions)s,'
        '\'{"%(keyname)s"}\','
        '('
        f'CASE WHEN {usage_value} > %(amount)s '
        f'THEN {usage_value} - %(amount)s '
        'ELSE 0 '
        'END '
        ')::text::jsonb)'
    )
    arity = 1

    def __init__(self, expression: str, keyname: str, amount: int, **extra):
        super().__init__(
            expression,
            keyname=keyname,
            amount=amount,
            **extra,
        )


class OrderCustomCharField(Func):
    """
    DO NOT use on fields other than CharField while the application maintains
    support for PostgreSQL below version 14.

    PostgreSQL 14 includes an improvement to "Allow some array functions to
    operate on a mix of compatible data types", which "makes them less fussy
    about exact matches of argument types"
    (https://www.postgresql.org/docs/14/release-14.html).

    However, older Postgres requires an exact match, meaning that the array
    argument must be cast to `varchar` to match `CharField`.

    After Kobo drops support for older Postgres, this class could be renamed to
    `OrderCustom`, and the explicit `varchar` cast could be removed.
    """

    function = 'array_position'
    # By default, `order_list` is treated as `text[]` and must be cast to
    # `varchar[]`
    template = '%(function)s(ARRAY%(order_list)s::varchar[], %(expressions)s)'
    # template = '%(function)s(ARRAY%(order_list)s, %(expressions)s)'
    arity = 1

    def __init__(
        self,
        expression: str,
        order_list: list,
        **extra
    ):
        if expression.startswith('-'):
            order_list.reverse()
            expression = expression[1:]

        super().__init__(expression, order_list=order_list, **extra)


class RemoveJSONFieldAttribute(Func):

    """
    Remove attribute from models.JSONField. It supports nested attributes by
    targeting the attribute with its dotted path.
    E.g., to remove `foo1` in `{"foo": {"foo1": "bar1", "foo2": "bar2"}}`,
    `foo.foo1` should be passed as `attribute_dotted_path` parameter.
    """

    arg_joiner = ' #- '
    template = '%(expressions)s'
    arity = 2

    def __init__(
        self,
        expression: str,
        attribute_dotted_path: str,
        **extra,
    ):
        super().__init__(
            expression,
            Value('{' + attribute_dotted_path.replace('.', ',') + '}'),
            **extra,
        )


class UpdateJSONFieldAttributes(Func):
    """
    Updates several attributes at once of a models.JSONField without overwriting
    the whole document.
    Avoids race conditions when document is saved in two different transactions
    at the same time. (i.e.: `Asset._deployment['status']`)
    https://www.postgresql.org/docs/current/functions-json.html

    Notes from postgres docs:
    > Does not operate recursively: only the top-level array or object
    > structure is merged
    """
    arg_joiner = ' || '
    template = '%(expressions)s'
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
