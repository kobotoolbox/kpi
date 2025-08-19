# coding: utf-8
import celery
from django.utils import timezone

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.exceptions import BadAssetTypeException, DeploymentNotFound
from kpi.models.asset_file import AssetFile

from .backends import DEPLOYMENT_BACKENDS
from .base_backend import BaseDeploymentBackend
from .kc_access.utils import kc_transaction_atomic


class DeployableMixin:

    def sync_media_files_async(self, always=True):
        """
        Synchronize form media files with deployment backend asynchronously
        """
        if always or self.asset_files.filter(
            file_type=AssetFile.FORM_MEDIA, synced_with_backend=False
        ).exists():
            self.save(create_version=False, adjust_content=False)
            # Not using .delay() due to circular import in tasks.py
            celery.current_app.send_task('kpi.tasks.sync_media_files', (self.uid,))

    @property
    def can_be_deployed(self):
        return self.asset_type and self.asset_type == ASSET_TYPE_SURVEY

    def connect_deployment(self, backend: str, **kwargs):
        deployment_backend = self.__get_deployment_backend(backend)
        with kc_transaction_atomic():
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

            self._mark_latest_version_as_deployed(save=False)
            self.sync_media_files_async()  # This saves the asset to the database!

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

    def _mark_latest_version_as_deployed(self, save: bool = True):
        """
        `sync_kobocat_xforms` calls this, since it manipulates
        `_deployment_data` directly. Everything else should probably call
        `deploy()` above.

        If `self.save()` is called after this method, `save` can be set
        to `False` to avoid writing the `Asset` twice to the database.

        The latest `AssetVersion` is always saved to the database unless its
        `deployed` flag was already set to `True`.
        """
        latest_version = self.latest_version
        if not latest_version.deployed:
            latest_version.deployed = True
            # The save method updates `date_modified` of the version, so do not
            # call it unless the `deployed` flag has actually been modified.
            # Redeployments without content modification are normal, e.g. when
            # form media files are changed.
            latest_version.save()

        self.date_deployed = timezone.now()

        if save:
            self.save(
                update_fields=['date_deployed'],
                create_version=False,
                adjust_content=False,
            )

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
