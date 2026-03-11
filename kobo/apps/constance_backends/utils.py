from __future__ import annotations

import json

from typing import Union


def to_python_object(
    object_or_str: Union[list, dict, str]
) -> Union[list, dict]:
    """
    Returns a python object from `object_or_str`.
    """
    if isinstance(object_or_str, (dict, list)):
        return object_or_str

    return json.loads(object_or_str)
