# coding: utf-8
from __future__ import (division, print_function, absolute_import,
                        unicode_literals)

from django import template

register = template.Library()


@register.filter(name="repeat")
def repeat(value, count):
    """
    Returns a string of an identical characters n times

    :param value: str. Character to repeat
    :param count: int. Number of times
    :return:
    """
    return value * count
