# -*- coding: utf-8 -*-
from __future__ import absolute_import
import sys

from .base import *
from kpi.utils.log import logging

# When using `./manage.py runserver_plus`, print output is not
# displayed in the console. This monkey-patch makes it work.
# Pretty buggy, only for dev environment

old_stdout = sys.stdout
is_ipython = False

try:
    get_ipython()
    is_ipython = True
except Exception as e:
    pass


class F:
    def __init__(self):
        pass

    def write(self, message):
        logging.debug(message.rstrip())


# Patch only if not in iPython console
if not is_ipython:
    F.flush = old_stdout.flush
    try:
        sys.stdout = F()
    except Exception as e:
        sys.stdout = old_stdout
