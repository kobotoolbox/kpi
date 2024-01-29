# coding: utf-8
from .base import *

################################
# Django Framework settings    #
################################

# Force `DEBUG` and `TEMPLATE_DEBUG` to `False`
DEBUG = False
TEMPLATES[0]['OPTIONS']['debug'] = False
