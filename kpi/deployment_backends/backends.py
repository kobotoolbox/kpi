# coding: utf-8
from .mock_backend import MockDeploymentBackend
from .openrosa_backend import OpenRosaDeploymentBackend

DEPLOYMENT_BACKENDS = {
    'mock': MockDeploymentBackend,
    'kobocat': OpenRosaDeploymentBackend,
    'openrosa': OpenRosaDeploymentBackend,
}
