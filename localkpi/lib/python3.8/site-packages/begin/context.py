"Program execution context"
import warnings


class SwizzleContext(object):
    """Type switching context object base class

    Supports the context manager protocol to switch the instance from a
    MutableContext to the protected Context.
    """

    _protected = {
        '_protected': None,
        'opts_current': None,
        'opts_next': tuple(),
        'opts_previous': tuple(),
        'return_values': tuple()
    }

    def __enter__(self):
        self.__class__ = Context
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.__class__ = MutableContext

    @property
    def last_return(self):
        try:
            return self.return_values[-1]
        except IndexError:
            return None

    @property
    def return_value(self):
        warnings.warn(
            "The 'return_value' property will be removed in future versions.  "
            "Use 'last_return' instead.",
            DeprecationWarning, stacklevel=2
        )
        return self.last_return


class MutableContext(SwizzleContext):
    """Mutable context object

    Only protected properties may be assigned to. Constructor ensures all
    protected properties are initialised correctly.
    """

    def __init__(self):
        self.clear()

    def __setattr__(self, name, value):
        if not name.startswith('__') and name not in self._protected:
            msg = "attempt to assign value to to immutable attribute '{0}'".format(name)
            raise AttributeError(msg)
        object.__setattr__(self, name, value)

    def clear(self):
        for name in self._protected:
            if name.startswith('_'):
                continue
            setattr(self, name, self._protected[name])


class Context(SwizzleContext):
    """Protected context object

    Attempts to assign to protected properties will raise an AttributeError.
    """

    def __setattr__(self, name, value):
        if name in self._protected:
            msg = "attempt to assign value to to immutable attribute '{0}'".format(name)
            raise AttributeError(msg)
        object.__setattr__(self, name, value)


context = MutableContext()
