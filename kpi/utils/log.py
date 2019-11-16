# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

import logging as stdlib_logging


def get_default_logger():
    return stdlib_logging.getLogger("console_logger")


# logging does not print to stdout when RAVEN/sentry is activated.
# To avoid to call logging.getLogger everywhere, we overload logging
logging = get_default_logger()


