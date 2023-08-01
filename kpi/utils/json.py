import json

from django.core.serializers.json import DjangoJSONEncoder
from django.utils.functional import Promise
from django.utils.encoding import force_str
from django.utils.text import normalize_newlines


class LazyJSONEncoder(DjangoJSONEncoder):

    def default(self, obj):
        if isinstance(obj, Promise):
            return force_str(obj)
        return super().default(obj)


class LazyJSONSerializable:
    """
    Wrapper for python objects (such as lists or dicts) which contain lazy gettext
    objects and could not be interpreted when the application loads.

    It can be JSON serialized.
    """
    def __init__(self, o):
        self.object = o

    def __repr__(self):
        return self.__str__()

    def __eq__(self, *args, **kwargs):
        other_object = args[0]
        if isinstance(other_object, str):
            return other_object == self.__str__()
        return other_object == self.object

    def __str__(self):
        try:
            value = json.dumps(self.object, indent=2, cls=LazyJSONEncoder)
        except json.JSONDecodeError:
            return self.object

        return normalize_newlines(value)
