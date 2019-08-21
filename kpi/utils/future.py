# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

try:
    from cyordereddict import OrderedDict
except ImportError:
    from collections import OrderedDict

try:
    from cStringIO import StringIO
except ImportError:
    from io import StringIO

try:
    range = xrange
except NameError:
    range = range


try:
    unicode = unicode
    basestring = basestring
except NameError:  # Python 3
    basestring = str
    unicode = str

str_types = (basestring,)
