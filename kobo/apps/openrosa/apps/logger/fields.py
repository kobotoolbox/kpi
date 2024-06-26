# coding: utf-8
from collections.abc import Callable

from django.core.exceptions import FieldError
from django.db import models


class LazyDefaultBooleanField(models.PositiveSmallIntegerField):
    """
    Allows specifying a default value for a new field without having to rewrite
    every row in the corresponding table when migrating the database.

    Whenever the database contains a null:
        1. The field will present the default value instead of None;
        2. The field will overwrite the null with the default value if the
           instance it belongs to is saved.

    models.BooleanField can't be nullable, so we use models.IntegerField to mimic
    models.BooleanField behaviour

    Based on `kpi.fields.LazyDefaultJSONBField`
    """
    def __init__(self, *args, **kwargs):
        if kwargs.get('null', False):
            raise FieldError('Do not manually specify null=True for a '
                             'LazyDefaultBooleanField')
        self.lazy_default = kwargs.get('default')
        if self.lazy_default is None:
            raise FieldError('LazyDefaultBooleanField requires a default that '
                             'is not None')
        elif not isinstance(self.lazy_default, bool):
            raise FieldError("LazyDefaultBooleanField requires the default value "
                             "to be a boolean")

        kwargs['null'] = True
        kwargs['default'] = None
        super().__init__(*args, **kwargs)

    def _get_lazy_default(self):
        if isinstance(self.lazy_default, Callable):
            return self.lazy_default()
        else:
            return self.lazy_default

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        kwargs['default'] = self.lazy_default
        del kwargs['null']
        return name, path, args, kwargs

    def from_db_value(self, value, *args, **kwargs):
        if value is None:
            return self._get_lazy_default()
        # We want to play with booleans on Python side.
        return True if value == 1 else False

    def pre_save(self, model_instance, add):
        value = getattr(model_instance, self.attname)
        if value is None:
            setattr(model_instance, self.attname, self._get_lazy_default())
            value = self.__to_integer(self._get_lazy_default())

        return value

    def __to_integer(self, value):
        # We want to play with integers on DB side.
        return 1 if value is True else 0
