from __future__ import annotations

import json

from typing import Union
from kpi.utils.json import LazyJSONSerializable


def to_python_object(
    object_or_str: Union['LazyJSONSerializable', str]
) -> Union[list, dict]:
    """
    Returns a python object from `object_or_str`.
    """
    # If a Constance setting is a `LazyJSONSerializable` object,
    # `constance.config.SETTING` does not return the same type of object depending
    # on whether the setting was saved in its back end or not. From the back end,
    # it returns the string representation. Otherwise, it returns the
    # `LazyJSONSerializable` object itself.
    if isinstance(object_or_str, LazyJSONSerializable):
        return object_or_str.object

    return json.loads(object_or_str)
