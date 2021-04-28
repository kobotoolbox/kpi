"Help formatters for use with argparse"
import argparse


class RawDescription(object):
    """Help message formatter which retains any formatting in descriptions.

    Based on argparse.RawDescriptionHelpFormatter from Python standard library
    Copyright 2001-2014 Python Software Foundation; All Rights Reserved
    """

    def _fill_text(self, text, width, indent):
        return ''.join([indent + line for line in text.splitlines(True)])


class RawArguments(object):
    """Help message formatter which retains formatting of all argument text.

    Based on argparse.RawTextHelpFormatter from Python standard library
    Copyright 2001-2014 Python Software Foundation; All Rights Reserved
    """

    def _split_lines(self, text, width):
        return text.splitlines()


class ArgumentDefaults(object):
    """Help message formatter which adds default values to argument help.

    Based on argparse.ArgumentDefaultsHelpFormatter from Python standard library
    Copyright 2001-2014 Python Software Foundation; All Rights Reserved
    """

    def _get_help_string(self, action):
        help = action.help
        if '%(default)' not in action.help:
            if action.default is not argparse.SUPPRESS:
                defaulting_nargs = [argparse.OPTIONAL, argparse.ZERO_OR_MORE]
                if action.option_strings or action.nargs in defaulting_nargs:
                    help += ' (default: %(default)s)'
        return help


class RemoveSubcommandsLine(object):
    """Removes line of subcommand names from help output.

    Based on Jeppe Ledet-Pederson's solution for hiding metavar in command
    listing. http://stackoverflow.com/a/13429281
    """

    def _format_action(self, action):
        parts = argparse.HelpFormatter._format_action(self, action)
        if action.nargs == argparse.PARSER:
            parts = "\n".join(parts.split("\n")[1:])
        return parts


def compose(*mixins, **kwargs):
    """Compose a new help formatter class for argparse.

    Accepts a variable number of mixin class and uses these as base classes
    with multiple inheritance against argparse.HelpFormatter to create a new
    help formatter class.
    """
    if not set(['name']).issuperset(kwargs.keys()):
        unknown = set(kwargs.keys())
        unknown.discard(set(['name']))
        msg = "compose() got an unexpected keyword argument '{0}'".format(unknown.pop())
        raise TypeError(msg)
    name = kwargs.get('name', 'CompositeHelpFormatter')
    return type(name, tuple(mixins) + (argparse.HelpFormatter,), {})

