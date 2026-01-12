from django.conf import settings
from django.utils.deconstruct import deconstructible
from django.utils.module_loading import import_string


@deconstructible(path='kobo.apps.storage_backends.base.KpiDefaultStorage')
class KpiDefaultStorage:
    """
    Deconstructible storage proxy used to keep Django migration state stable.

    The proxy is serialized in migrations, while the actual storage backend
    (FileSystem, S3, Azure, etc.) is resolved dynamically at runtime via settings.
    This prevents environment-specific storage backends from generating
    spurious migrations.
    """

    REFERENCE_SETTING = settings.STORAGES['default']['BACKEND']

    def __init__(self, *args, **kwargs):
        self._args = args
        self._kwargs = kwargs
        self._backend = None

    def __getattr__(self, name):
        return getattr(self._get_backend(), name)

    def __repr__(self):
        if self._backend is None:
            return '<KpiDefaultStorage: (uninitialized)>'

        return (
            f'<KpiDefaultStorage proxy: '
            f'{self._backend.__class__.__name__} at 0x{id(self._backend):x}>'
        )

    @property
    def backend(self):
        return self._get_backend()

    def _get_backend(self):

        if self._backend is not None:
            return self._backend

        cls = import_string(self.REFERENCE_SETTING)
        self._backend = cls(*self._args, **self._kwargs)

        return self._backend


@deconstructible(path='kobo.apps.storage_backends.base.KpiPrivateDefaultStorage')
class KpiPrivateDefaultStorage(KpiDefaultStorage):
    """
    Deconstructible storage proxy used to keep Django migration state stable.

    The proxy is serialized in migrations, while the actual storage backend
    (FileSystem, S3, Azure, etc.) is resolved dynamically at runtime via settings.
    This prevents environment-specific storage backends from generating
    spurious migrations.
    """

    REFERENCE_SETTING = settings.PRIVATE_STORAGE_CLASS

    def __repr__(self):
        if self._backend is None:
            return '<KpiPrivateDefaultStorage: (uninitialized)>'

        return (
            f'<KpiPrivateDefaultStorage proxy: '
            f'{self._backend.__class__.__name__} at 0x{id(self._backend):x}>'
        )


default_kpi_storage = KpiDefaultStorage()
default_kpi_private_storage = KpiPrivateDefaultStorage()
