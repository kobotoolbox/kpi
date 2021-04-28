"""Utility functions for begins"""
from distutils.util import strtobool as _tobool
from argparse import FileType as tofile

def tobool(value):
    """Convert a string representation of truth to True or False.

    True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
    are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
    'value' is anything else.
    """
    if isinstance(value, bool):
        return value
    return bool(_tobool(value))

def tolist(value=None, sep=',', empty_strings=False):
    """Convert a string to a list.

    The input string is split on the separator character. The default separator
    is ','. An alternative separator may be passed as the 'sep' keyword. If no
    string value is provided a function is returned that splits a string on the
    provided separator, or default if none was provided. Any empty strings are
    removed from the resulting list. This behaviour can be changed by passing
    True as the 'empty_strings' keyword argument.
    """
    def tolist(value):
        result = value.split(sep)
        if not empty_strings:
            return [r for r in result if len(r) > 0]
        return result
    if value is None:
        return tolist
    return tolist(value)
