# coding: utf-8
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.exceptions import BadAssetTypeException, DeploymentNotFound
from kpi.models.asset_file import AssetFile
from kpi.tasks import sync_media_files
from .backends import DEPLOYMENT_BACKENDS
from .base_backend import BaseDeploymentBackend


class DeployableMixin:

    def async_media_files(self, force=True):
        """
        Synchronize form media files with deployment backend asynchronously
        """
        if force or self.asset_files.filter(
            file_type=AssetFile.FORM_MEDIA, synced_with_backend=False
        ).exists():
            self.save(create_version=False, adjust_content=False)
            sync_media_files.delay(self.uid)

    @property
    def can_be_deployed(self):
        return self.asset_type and self.asset_type == ASSET_TYPE_SURVEY

    def connect_deployment(self, backend: str, **kwargs):
        deployment_backend = self.__get_deployment_backend(backend)
        deployment_backend.connect(**kwargs)

    def deploy(self, backend=False, active=True):
        """
        This method could be called `deploy_latest_version()`.
        """
        if self.can_be_deployed:
            if not self.has_deployment:
                self.connect_deployment(backend=backend, active=active)
                if self.has_deployment:  # Double-check, maybe overkill.
                    self.deployment.bulk_assign_mapped_perms()
            else:
                self.deployment.redeploy(active=active)

            self._mark_latest_version_as_deployed()
            self.async_media_files()

        else:
            raise BadAssetTypeException(
                'Only surveys may be deployed, but this asset is a '
                f'{self.asset_type}'
            )

    @property
    def deployment(self):
        if not self.has_deployment:
            raise DeploymentNotFound

        return self.__get_deployment_backend(self._deployment_data['backend'])

    @property
    def has_deployment(self):
        return 'backend' in self._deployment_data

    def set_deployment(self, deployment: BaseDeploymentBackend):
        setattr(self, '__deployment_backend', deployment)

    def _mark_latest_version_as_deployed(self):
        """ `sync_kobocat_xforms` calls this, since it manipulates
        `_deployment_data` directly. Everything else should probably call
        `deploy()` above """
        latest_version = self.latest_version
        latest_version.deployed = True
        latest_version.save()

    def __get_deployment_backend(self, backend: str) -> BaseDeploymentBackend:
        try:
            return getattr(self, '__deployment_backend')
        except AttributeError:
            pass

        try:
            deployment_backend = DEPLOYMENT_BACKENDS[backend](self)
        except KeyError as e:
            raise KeyError('cannot retrieve asset backend: {}'.format(backend))

        setattr(self, '__deployment_backend', deployment_backend)

        return deployment_backend
