# coding: utf-8
import base64


def base64_encodestring(obj):
    return base64.encodebytes(obj.encode()).decode()


def to_str(obj):
    if isinstance(obj, bytes):
        return obj.decode()
    return obj
