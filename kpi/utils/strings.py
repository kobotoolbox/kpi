import base64


def base64_encodestring(obj):
    return base64.encodebytes(obj.encode()).decode()


def to_str(obj):
    if isinstance(obj, bytes):
        return obj.decode()
    return obj


def split_lines_to_list(value: str) -> list:
    values = value.strip().split('\n')
    return [ip.strip() for ip in values if ip.strip()]
