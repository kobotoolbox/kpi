# coding: utf-8
from .mock_backend import MockDeploymentBackend
from .kobocat_backend import KobocatDeploymentBackend

DEPLOYMENT_BACKENDS = {
    'mock': MockDeploymentBackend,
    'kobocat': KobocatDeploymentBackend,
}
