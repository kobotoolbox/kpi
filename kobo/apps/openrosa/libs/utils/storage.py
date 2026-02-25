from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.utils.storage import rmdir as kpi_rmdir


def rmdir(directory: str):
    """
    Delete `directory` (and recursively all files and folders inside it).
    `directory` location must be relative to default storage.
    """
    kpi_rmdir(directory, default_kobocat_storage)
