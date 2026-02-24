from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.utils.storage import bulk_rmdir


def rmdir(directory: str):
    """
    Delete `directory` (and recursively all files and folders inside it).
    `directory` location must be relative to default storage.
    """
    bulk_rmdir([directory], default_kobocat_storage)
