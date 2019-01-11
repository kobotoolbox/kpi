# -*- coding: utf-8 -*-
from __future__ import absolute_import
import sys

from .base import *
from kpi.utils.log import logging

# When using `./manage.py runserver_plus`, print output is not
# displayed in the console. This monkey-patch makes it work.
# Very buggy, only for dev environment
old_stdout = sys.stdout


class F:
    def __init__(self):
        pass

    def write(self, message):
        logging.debug(message.rstrip())


F.flush = old_stdout.flush


try:
    sys.stdout = F()
except Exception as e:
    sys.stdout = old_stdout
