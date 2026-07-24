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


def strtobool(val) -> bool:
    """
    Convert a string representation of truth to true or false.

    True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
    are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
    'val' is anything else.

    This is copied and pasted from `distutils.util.strtobool()` in Python 3.10
    with some modifications.
    """
    val = str(val).lower()

    if val in ('y', 'yes', 't', 'true', 'on', '1'):
        return True
    elif val in ('n', 'no', 'f', 'false', 'off', '0'):
        return False
    else:
        raise ValueError('invalid truth value {!r}'.format(val))
