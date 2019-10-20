# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)
import base64
import sys

# These helpers are duplicated from `six`.
# When KPI stops support for Python2, this file can be removed and code
# can be replaced with Python3 code
PY2 = sys.version_info[0] == 2


def base64_encodestring(obj):
    if PY2:
        return base64.encodestring(obj)
    else:
        return base64.encodebytes(obj.encode()).decode()


def to_str(obj):
    if not PY2 and isinstance(obj, bytes):
        return obj.decode()
    return obj


def hashable_str(obj):
    if PY2 and isinstance(obj, str):
        return obj

    # utf-8 is not mandatory for Python3
    # TODO Remove when Python 2 support is dropped
    return obj.encode('utf-8')



