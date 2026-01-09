from django.conf import settings as django_settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible
from storages.backends.azure_storage import AzureStorage

from kobo.apps.storage_backends.s3boto3 import S3Boto3Storage


@deconstructible(path='kpi.deployment_backends.kc_access.storage.KobocatDefaultStorage')
class KobocatDefaultStorage:
    """
    Deconstructible storage proxy used to keep Django migration state stable.

    The proxy is serialized in migrations, while the actual storage backend
    (FileSystem, S3, Azure, etc.) is resolved dynamically at runtime via settings.
    This prevents environment-specific storage backends from generating
    spurious migrations.
    """

    def __init__(self, *args, **kwargs):
        self._args = args
        self._kwargs = kwargs
        self._backend = None

    def __getattr__(self, name):
        return getattr(self._get_backend(), name)

    def __repr__(self):
        if self._backend is None:
            return '<KobocatDefaultStorage: (uninitialized)>'

        return (
            f'<KobocatDefaultStorage proxy: '
            f'{self._backend.__class__.__name__} at 0x{id(self._backend):x}>'
        )

    def _get_backend(self):

        if self._backend is not None:
            return self._backend

        value = django_settings.KOBOCAT_DEFAULT_FILE_STORAGE

        if value.endswith('S3Boto3Storage'):
            self._backend = KobocatS3Boto3Storage(*self._args, **self._kwargs)
        elif value.endswith('AzureStorage'):
            self._backend = AzureStorage(*self._args, **self._kwargs)
        else:
            self._backend = KobocatFileSystemStorage(*self._args, **self._kwargs)

        return self._backend


default_kobocat_storage = KobocatDefaultStorage()


class KobocatFileSystemStorage(FileSystemStorage):

    def __init__(
        self,
        location=None,
        base_url=None,
        file_permissions_mode=None,
        directory_permissions_mode=None,
    ):
        location = (
            django_settings.KOBOCAT_MEDIA_ROOT if not location else location
        )
        super().__init__(
            location=location,
            base_url=base_url,
            file_permissions_mode=file_permissions_mode,
            directory_permissions_mode=directory_permissions_mode,
        )


class KobocatS3Boto3Storage(S3Boto3Storage):

    def __init__(self, **settings):
        # This allows KoboCAT to have a different bucket name, which is not recommended
        settings['bucket_name'] = django_settings.KOBOCAT_AWS_STORAGE_BUCKET_NAME
        super().__init__(**settings)
