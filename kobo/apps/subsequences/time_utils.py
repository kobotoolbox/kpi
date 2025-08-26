# idk if DRF is doing this work for us automatically, but if not, find another
# place where these utils already exist in the app

# if they must stay here, probably need to move utils.py to utils/something.py
# and put this in utils/time.py. can't go together due to circular imports

import datetime


def utc_datetime_to_js_str(dt: datetime.datetime) -> str:
    """
    Return a string to represent a `datetime` following the simplification of
    the ISO 8601 format used by JavaScript
    """
    # https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date-time-string-format
    if dt.utcoffset() or not dt.tzinfo:
        raise NotImplementedError('Only UTC datetimes are supported')
    return dt.isoformat().replace('+00:00', 'Z')


def js_str_to_datetime(js_str: str) -> datetime.datetime:
    """
    Return a `datetime` from a string following the simplification of the ISO
    8601 format used by JavaScript
    """
    return datetime.datetime.fromisoformat(js_str.replace('Z', '+00:00'))
