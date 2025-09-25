# Python 3.10+
from typing import Any
from django.db.models import F, Func, Value, JSONField, TextField
from django.db.models.functions import Coalesce
from django.contrib.postgres.fields import ArrayField
from django.db.models.fields.json import KeyTransform


# --- SQL primitives -----------------------------------------------------------

class JsonbConcat(Func):
    """Implements jsonb '||' operator (non-recursive merge)."""
    arg_joiner = ' || '
    template = '%(expressions)s'
    output_field = JSONField()


class JsonbSet(Func):
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


# --- Helpers -----------------------------------------------------------------

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


def _json_key(path_list: list[str], base_expr):
    """
    Build a nested KeyTransform chain: base->'k1'->'k2'->...
    """
    expr = base_expr
    for key in path_list:
        expr = KeyTransform(key, expr)
    return expr


def _merge_obj_at(expr, path_list: list[str], patch: dict, *, create_missing: bool = True):
    """
    Deep-merge a dict 'patch' into an object at 'path_list'.
    If the object at path doesn't exist, coalesce it to {} before merging.
    """
    existing = Coalesce(
        _json_key(path_list, expr),
        Value({}, output_field=JSONField()),
        output_field=JSONField(),
    )
    new_value = JsonbConcat(existing, Value(patch, output_field=JSONField()))
    return JsonbSet(expr, path_list, new_value, create_missing=create_missing)


def _set_at(expr, path_list: list[str], value: Any, *, create_missing: bool = True):
    """
    Set any JSON value (scalar/array/object) at 'path_list'.
    """
    return JsonbSet(expr, path_list, Value(value, output_field=JSONField()), create_missing=create_missing)


# --- Public API ---------------------------------------------------------------

class ReplaceValues(Func):
    """
    Single-op JSONB updater with Django-style '__' paths and root merge.

    Usage:
        # Root merge (non-destructive) when path=None (default)
        MyModel.objects.update(
            metadata=ReplaceValues('metadata', updates={'feature_flags': {'x': True}})
        )

        # Merge nested dict at dunder path
        MyModel.objects.update(
            metadata=ReplaceValues(
                'metadata',
                path='content__audio__automated_google_transcription',
                updates={'status': 'done', 'text': 'Bonjour'},
            )
        )

        # Set scalar at nested path
        MyModel.objects.update(
            metadata=ReplaceValues('metadata', path='flags__legacy', updates=False)
        )
    """
    output_field = JSONField()
    template = '%(expressions)s'  # render the built inner expression as-is
    arg_joiner = ', '

    def __init__(
        self,
        expression: str,
        *,
        updates: Any,
        path: str | None = None,
        create_missing: bool = True,
        **extra,
    ):
        """
        Parameters
        ----------
        expression : str
            JSONB field name (e.g., 'metadata').
        updates : Any
            - If path is None: must be a dict (will be merged at root, non-destructive).
            - If path is provided:
                * dict -> deep-merge at the given path
                * non-dict -> set value at the given path
        path : str | None
            Django-style dunder path (e.g., 'a__b__c'). None means root.
        create_missing : bool
            Create missing parents/keys when setting/merging.
        """
        expr = F(expression)

        if path is None:
            # Root-level operation: only dict-merge makes sense, to avoid nuking the whole JSON.
            if not isinstance(updates, dict):
                raise TypeError('When path=None, "updates" must be a dict for a root merge.')
            # Top-level merge is equivalent to merging each root key individually
            # to avoid clobbering existing nested objects.
            for key, val in updates.items():
                if isinstance(val, dict):
                    expr = _merge_obj_at(expr, [key], val, create_missing=create_missing)
                else:
                    expr = _set_at(expr, [key], val, create_missing=create_missing)
        else:
            # Nested path operation
            path_list = _split_path_dunder(path)
            if isinstance(updates, dict):
                expr = _merge_obj_at(expr, path_list, updates, create_missing=create_missing)
            else:
                expr = _set_at(expr, path_list, updates, create_missing=create_missing)

        super().__init__(expr, **extra)
