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
    # Make constance.config.SETTING return a consistent value when SETTING is a
    # LazyJSONSerializable object
    if isinstance(object_or_str, LazyJSONSerializable):
        return object_or_str.object

    if isinstance(object_or_str, dict) or isinstance(object_or_str, list):
        return object_or_str

    return json.loads(object_or_str)
