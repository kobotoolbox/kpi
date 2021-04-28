"Syntactic sugar for a programs 'main'."
from __future__ import absolute_import, division, print_function
import inspect
import itertools
import sys

from begin.wrappable import Wrapping
from begin import cmdline, context, convert

__all__ = ['start']


class Program(Wrapping):
    """Decorate the starting command of command line application

    The class instance is callable and will call the wrapped function without
    alteration. Calling the 'start()' method will process command line options
    and start the program appropriately.
    """

    def __init__(self, func, auto_convert=False, cmd_delim=None,
            sub_group=None, collector=None, **kwargs):
        if auto_convert:
            func = convert(_automatic=True)(func)
        Wrapping.__init__(self, func)
        self._cmd_delim = cmd_delim
        self._group = sub_group
        self._collector = collector
        self._parser = cmdline.create_parser(func, sub_group=self._group,
                collector=self._collector, **kwargs)

    def start(self, args=None):
        """Begin command line program

        By default will use the command line arguments passed when Python was
        initially started. New arguments can be passed through the args
        parameter.
        """
        commands = [[]]
        args = args if args is not None else sys.argv[1:]
        if len(args) > 0:
            commands = [list(group) for key, group in itertools.groupby(args, lambda x: x == self._cmd_delim) if not key]
        options = []
        for command in commands:
            opts = self._parser.parse_args(command)
            options.append(opts)
        context.clear()
        context.opts_next = tuple(options)
        for count, opts in enumerate(options):
            context.opts_next = context.opts_next[1:]
            context.opts_current = opts
            cmdline.apply_options(self.__wrapped__, opts,
                    run_main=(count==0), sub_group=self._group,
                    collector=self._collector)
            context.opts_previous += (opts,)
        context.opts_current = None
        return context.last_return


def start(func=None, **kwargs):
    """Return True if called in a module that is executed.

    Inspects the '__name__' in the stack frame of the caller, comparing it
    to '__main__'. Thus allowing the Python idiom:

    >>> if __name__ == '__main__':
    ...     pass

    To be replace with:

    >>> import begin
    >>> if begin.start():
    ...    pass

    Can also be used as a decorator to register a function to run after the
    module has been loaded.

    >>> @begin.start
    ... def main():
    ...     pass

    This also inspects the stack frame of the caller, choosing whether to call
    function immediately. Any definitions following the function wont be
    called until after the main function is complete.

    If used as a decorator, and the decorated function accepts either
    positional or keyword arguments, a command line parser will be generated
    and used to parse command line options.

    >>> @begin.start
    ... def main(first, second=''):
    ...     pass

    This will cause the command line parser to accept two options, the second
    of which defaults to ''.

    Default values for command line options can also be set from the current
    environment, using the uppercased version of an options name. In the
    example above, the environment variable 'FIRST' will set a default value
    for the first argument.

    To use a prefix with expected environment variables (for example, to
    prevent collisions) give an 'env_prefix' argument to the decorator.

    >>> @begin.start(env_prefix='PY_')
    ... def main(first, second=''):
    ...     pass

    The environment variable 'PY_FIRST' will be used instead of 'FIRST'.
    """
    def _start(func):
        prog = Program(func, **kwargs)
        if func.__module__ == '__main__':
            try:
                prog.start()
            except KeyboardInterrupt:
                sys.exit(1)
        return prog

    # start() is a decorator factory
    if func is None and len(kwargs) > 0:
        return _start
    # start() is a boolean function
    elif func is None:
        stack = inspect.stack()
        if len(stack) < 1:
            return False
        frame = stack[1][0]
        if not inspect.isframe(frame):
            return False
        return frame.f_globals['__name__'] == '__main__'
    # not correctly used to decorate a function
    elif not callable(func):
        raise ValueError("Function '{0!r}' is not callable".format(func))
    return _start(func)
