# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)
import base64

from django.utils.six import PY2, BytesIO
from django.utils.six.moves import cStringIO as StringIO

# ToDo When Python2 support is dropped, this helper should be removed and
# related code should be replaced with Python 3 code.


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
    return obj.encode('utf-8')


class ObjectIO(object):
    """
    ToDo: When Python2 support is dropped,
    remove this class and wherever it's imported and use `BytesIO` instead.
    """
    def __init__(self):
        if PY2:
            self.__obj = StringIO()
        else:
            self.__obj = BytesIO()

    def get_obj(self):
        return self.__obj
