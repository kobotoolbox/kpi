import constance


class LazyMaxRetriesInt:
    """
    Constance settings cannot be used as default function parameters since they are
    evaluated at import time. This wrapper retrieves `constance.config.HOOK_MAX_RETRIES`
    dynamically.

    The returned value adds 1 to include the initial execution. For example,
    `HOOK_MAX_RETRIES = 3` results in up to 4 total attempts (1 initial attempt
    + 3 retries).
    """

    def __call__(self, *args, **kwargs):
        return constance.config.HOOK_MAX_RETRIES + 1

    def __repr__(self):
        return str(int(constance.config.HOOK_MAX_RETRIES) + 1)

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
