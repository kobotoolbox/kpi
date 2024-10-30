# coding: utf-8
import base64


def base64_encodestring(obj):
    return base64.encodebytes(obj.encode()).decode()


def to_str(obj):
    if isinstance(obj, bytes):
        return obj.decode()
    return obj


def split_lines_to_list(value: str) -> list:
    ip_addresses = value.strip().split('\n')
    return [ip.strip() for ip in ip_addresses if ip.strip()]
