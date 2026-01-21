import os
import shutil

from django.core.files.storage import FileSystemStorage, default_storage
from storages.backends.s3 import S3Storage


def is_filesystem_storage(storage) -> bool:
    # Case 1: storage *is* a FileSystemStorage
    if isinstance(storage, FileSystemStorage):
        return True

    # Case 2: storage is a proxy exposing a backend
    backend = getattr(storage, 'backend', None)
    if backend is not None and isinstance(backend, FileSystemStorage):
        return True

    return False


def is_s3_storage(storage) -> bool:
    # Case 1: storage *is* a S3Storage
    if isinstance(storage, S3Storage):
        return True

    # Case 2: storage is a proxy exposing a backend
    backend = getattr(storage, 'backend', None)
    if backend is not None and isinstance(backend, S3Storage):
        return True

    return False


def rmdir(directory: str):
    """
    Delete `directory` (and recursively all files and folders inside it).
    `directory` location must be relative to default storage.
    """
    def _recursive_delete(path):
        directories, files = default_storage.listdir(path)
        for file_ in files:
            default_storage.delete(os.path.join(path, file_))
        for directory_ in directories:
            _recursive_delete(os.path.join(path, directory_))

    if is_filesystem_storage(default_storage):
        if default_storage.exists(directory):
            shutil.rmtree(default_storage.path(directory))
    else:
        _recursive_delete(directory)
