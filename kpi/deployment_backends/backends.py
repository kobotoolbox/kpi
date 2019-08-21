# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from .mock_backend import MockDeploymentBackend
from .kobocat_backend import KobocatDeploymentBackend

DEPLOYMENT_BACKENDS = {
    'mock': MockDeploymentBackend,
    'kobocat': KobocatDeploymentBackend,
}
