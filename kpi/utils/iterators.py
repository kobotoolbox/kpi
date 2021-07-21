# coding: utf-8
import types
from typing import Generator, Union


def to_int(
    iter_obj: Union[list, tuple, Generator[str, None, None]],
    unique: bool = True,
) -> Union[list, tuple, Generator[int, None, None]]:
    """
    Coerce items of an object which can be iterated to integer
    """
    # If `iterator` is a generator, keep it as is
    if isinstance(iter_obj, types.GeneratorType):
        if not unique:
            return (int(item) for item in iter_obj)

        # There are no real benefits to use `unique=True` with a generator,
        # if the generator is all consumed because `unique_integers` will take
        # just as much memory as a the whole generator coerced into a set.
        def _get_unique_integers_generator():
            unique_integers = set()
            for item in iter_obj:
                if item not in unique_integers:
                    yield item
                    unique_integers.add(item)

        return _get_unique_integers_generator()

    type_ = type(iter_obj)
    coerced = map(int, iter_obj)
    if unique:
        return type_(set(coerced))
    return type_(coerced)

