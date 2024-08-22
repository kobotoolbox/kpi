# coding: utf-8
from .mock_backend import MockDeploymentBackend
from .kobocat_backend import KobocatDeploymentBackend
from .openrosa_backend import OpenRosaDeploymentBackend

DEPLOYMENT_BACKENDS = {
    'mock': MockDeploymentBackend,
    'kobocat': KobocatDeploymentBackend,
    'openrosa': OpenRosaDeploymentBackend,
}
