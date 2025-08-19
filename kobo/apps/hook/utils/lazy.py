import constance


class LazyMaxRetriesInt:
    """
    constance settings cannot be used as default parameters of a function.
    This wrapper helps to return the value of `constance.config.HOOK_MAX_RETRIES`
    on demand.
    """

    def __call__(self, *args, **kwargs):
        return constance.config.HOOK_MAX_RETRIES

    def __repr__(self):
        return str(constance.config.HOOK_MAX_RETRIES)

    def __eq__(self, other):
        if isinstance(other, int):
            return self() == other
        return NotImplemented

    def __ne__(self, other):
        if isinstance(other, int):
            return self() != other
        return NotImplemented

    def __lt__(self, other):
        if isinstance(other, int):
            return self() < other
        return NotImplemented

    def __le__(self, other):
        if isinstance(other, int):
            return self() <= other
        return NotImplemented

    def __gt__(self, other):
        if isinstance(other, int):
            return self() > other
        return NotImplemented

    def __ge__(self, other):
        if isinstance(other, int):
            return self() >= other
        return NotImplemented
