# coding: utf-8
from typing import Union


def compare(iter_a: Union[list, tuple], iter_b: Union[list, tuple]):

    if not isinstance(iter_a, type(iter_b)):
        return False

    if len(iter_a) != len(iter_b):
        return False

    return iter_a == iter_b


def to_int(iterator: list, unique: bool = True):

    coerced = map(int, iterator)
    if unique:
        return list(set(coerced))
    return list(coerced)


