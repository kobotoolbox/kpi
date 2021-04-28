"""
markup filters for django-markitup

Time-stamp: <2009-03-18 11:44:57 carljm markup.py>

This module provides a ``filter_func`` module-level markup filter
function based on the MARKITUP_PREVIEW_FILTER setting.

MARKITUP_PREVIEW_FILTER should be a two-tuple, where the first element
is a dotted-path string to a markup filter function, and the second
element is a dictionary of kwargs to be passed to the filter function
along with the markup to parse.

For instance, if MARKITUP_PREVIEW_FILTER is set to::

    ('markdown.markdown', {'safe_mode': True})

then calling ``filter_func(text)`` is equivalent to::

    from markdown import markdown
    markdown(text, safe_mode=True)

Though the implementation differs, the format of the
MARKITUP_PREVIEW_FILTER setting is inspired by James Bennett's
django-template-utils_.

.. _django-template-utils: http://code.google.com/p/django-template-utils/

"""
from __future__ import unicode_literals

from functools import partial, wraps

from markitup.settings import MARKITUP_PREVIEW_FILTER

if MARKITUP_PREVIEW_FILTER is None:
    filter_func = lambda text: text
else:
    filter_path, filter_kwargs = MARKITUP_PREVIEW_FILTER
    # Don't coerce to unicode on python 2
    module, funcname = filter_path.rsplit(str('.'), 1)
    func = getattr(__import__(module, {}, {}, [funcname]), funcname)
    filter_func = wraps(func)(partial(func, **filter_kwargs))
