"Decorator utilities for wrapping functions"

__all__ = ['Wrapping']


class Wrapping(object):
    """Base class for function decorating objects

    Wraps a function, copying the functions special variables.
    """

    ASSIGNMENTS = ('__annotations__', '__doc__', '__module__', '__name__')

    def __init__(self, func):
        self.__wrapped__ = func
        for name in self.ASSIGNMENTS:
            setattr(self, name, getattr(func, name, None))

    def __call__(self, *args, **kwargs):
        return self.__wrapped__(*args, **kwargs)
