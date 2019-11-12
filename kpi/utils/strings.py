# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)
import base64


def base64_encodestring(obj):
    return base64.encodebytes(obj.encode()).decode()


def to_str(obj):
    if isinstance(obj, bytes):
        return obj.decode()
    return obj


def hashable_str(obj):
    return obj.encode()
