import json
from typing import Any

from django.db.models import F, Func, Value, JSONField, TextField
from django.db.models.functions import Coalesce
from django.contrib.postgres.fields import ArrayField
from django.db.models.fields.json import KeyTransform
from django.db.models import Field, Lookup
from django.db.models.expressions import Func, Value


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


class JSONBConcat(Func):
    """
    Implements jsonb '||' operator (non-recursive merge).
    """

    arg_joiner = ' || '
    template = '%(expressions)s'
    output_field = JSONField()


class JSONBSet(Func):
    """
    Wraps jsonb_set(target, path text[], new_value, create_missing boolean).
    """

    function = 'jsonb_set'
    output_field = JSONField()

    def __init__(self, target, path, new_value, create_missing: bool = True, **extra):
        if not isinstance(path, (list, tuple)):
            raise TypeError('path must be a list/tuple of keys')
        super().__init__(
            target,
            Value(path, output_field=ArrayField(base_field=TextField())),
            new_value,
            Value(bool(create_missing)),
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
    Single-op JSONB updater using Django-style '__' paths and root merge.

    Usage:
        # Root merge (non-destructive)
        MyModel.objects.update(
            data=UpdateJSONFieldAttributes('data', updates={'feature_flags': {'x': True}})
        )

        # Nested merge (dict)
        MyModel.objects.update(
            data=UpdateJSONFieldAttributes(
                'data',
                path='profile__address',
                updates={'city': 'Toronto', 'postal_code': 'M5H'},
            )
        )

        # Nested set (scalar/array)
        MyModel.objects.update(
            data=UpdateJSONFieldAttributes('data', path='flags__legacy', updates=False)
        )
    """
    output_field = JSONField()
    template = '%(expressions)s'
    arg_joiner = ', '

    def __init__(
        self,
        expression: str,
        updates: Any,
        path: str | None = None,
        **extra,
    ):
        expr = F(expression)

        if path is None:
            if not isinstance(updates, dict):
                raise TypeError(
                    'When path=None, "updates" must be a dict for a root merge.'
                )

            # Merge each top-level key independently (preserve existing siblings).
            for key, val in updates.items():
                if isinstance(val, dict):
                    expr = _merge_obj_at(expr, [key], val)
                else:
                    # Ensure parent exists (root key), then set scalar/array.
                    expr = _ensure_parents(expr, [])  # no-op for root
                    expr = JSONBSet(
                        expr,
                        [key],
                        Value(val, output_field=JSONField()),
                        create_missing=True,
                    )
        else:
            path_list = _split_path_dunder(path)
            parent_path = path_list[:-1]
            if isinstance(updates, dict):
                # Make sure parents exist, then deep-merge at the object path.
                expr = _ensure_parents(expr, parent_path)
                expr = _merge_obj_at(expr, path_list, updates)
            else:
                # Make sure parents exist, then set scalar/array at leaf.
                expr = _ensure_parents(expr, parent_path)
                expr = JSONBSet(
                    expr,
                    path_list,
                    Value(updates, output_field=JSONField()),
                    create_missing=True,
                )

        super().__init__(expr, **extra)


def _ensure_parents(expr, parents: list[str]):
    """
    Ensure that each prefix in 'parents' exists and is an object.
    For each prefix, set it to itself if present, otherwise to {}.
    """

    for i in range(len(parents)):
        prefix = parents[: i + 1]
        existing = Coalesce(
            _json_key(prefix, expr),
            Value({}, output_field=JSONField()),
            output_field=JSONField(),
        )
        expr = JSONBSet(expr, prefix, existing, create_missing=True)
    return expr


def _json_key(path_list: list[str], base_expr):
    """
    Build a nested KeyTransform chain to access JSON keys.
    Returns base_expr when path_list is empty.
    """

    expr = base_expr
    for key in path_list:
        expr = KeyTransform(key, expr)
    return expr


def _merge_obj_at(expr, path_list: list[str], patch: dict):
    """
    Deep-merge a dict 'patch' into an object at 'path_list'.
    If object at the path doesn't exist, coalesce it to {} before merging.
    """

    existing = Coalesce(
        _json_key(path_list, expr),
        Value({}, output_field=JSONField()),
        output_field=JSONField(),
    )
    new_value = JSONBConcat(existing, Value(patch, output_field=JSONField()))
    return JSONBSet(expr, path_list, new_value, create_missing=True)


def _split_path_dunder(path: str) -> list[str]:
    """
    Convert a Django-style '__' path into a list of keys.
    Example: 'content__audio__foo' -> ['content', 'audio', 'foo'].
    """

    s = (path or '').strip()
    if not s:
        raise ValueError('path must be a non-empty string when provided')
    parts = s.split('__')
    if any(p == '' for p in parts):
        raise ValueError('invalid path: consecutive or trailing "__"')
    return parts
