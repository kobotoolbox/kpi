# coding: utf-8
from copy import deepcopy

from .base import WEBPACK_LOADER
REAL_WEBPACK_LOADER = deepcopy(WEBPACK_LOADER)

from .testing import *

# `testing.py` uses `FakeWebpackLoader`, but Cypress actually needs the
# front-end application to be operable. Restore the base `WEBPACK_LOADER`
# configuration
WEBPACK_LOADER = REAL_WEBPACK_LOADER
assert 'Fake' not in WEBPACK_LOADER['DEFAULT'].get('LOADER_CLASS', '')
