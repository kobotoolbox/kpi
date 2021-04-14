# coding: utf-8

def compare(iter_a, iter_b):
    pass


def to_int(iterator: list, unique: bool = True):

    coerced = map(int, iterator)
    if unique:
        return list(set(coerced))
    return list(coerced)


