"Subcommand support for command lines"
from collections import defaultdict

try:
    from collections.abc import MutableMapping
except ImportError:
    from collections import MutableMapping

import pkg_resources


class Collector(dict):
    """Collect functions for use as subcommands"""

    def commands(self):
        for name in sorted(self):
            yield self[name]

    def load_plugins(self, entry_point):
        for func in pkg_resources.iter_entry_points(group=entry_point):
            self.register(func)

    def register(self, func, name=None):
        name = func.__name__ if name is None else name
        if name in self:
            msg = "Function named '{0}' already registered".format(name)
            raise ValueError(msg)
        self[name] = func


def subcommand(func=None, name=None, group=None, collector=None):
    """Register function as a program's subcommand

    Functions are registered with the default subcommand collector, unless a
    custom collector is provided through the 'collector' argument. Subcommands
    will automatically be included in the generated command line support.
    """
    def wrapper(func):
        collector.register(func, name=name)
        return func
    collector = COLLECTORS[group] if collector is None else collector
    if func is not None:
        return wrapper(func)
    return wrapper


COLLECTORS = defaultdict(Collector)
