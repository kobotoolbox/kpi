# coding: utf-8
import base64


def base64_encodestring(obj):
    return base64.encodebytes(obj.encode()).decode()


def dict_lists2strings(d: dict) -> dict:
    """
    Convert lists in a dict to joined strings.

    :param d: The dict to convert.
    :returns: The converted dict.
    """

    for k, v in d.items():
        if isinstance(v, list) and all([isinstance(e, str) for e in v]):
            d[k] = ' '.join(v)
        elif isinstance(v, dict):
            d[k] = dict_lists2strings(v)

    return d
