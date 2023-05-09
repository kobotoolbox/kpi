import os
import shutil

from django.core.files.storage import default_storage, FileSystemStorage


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

    if isinstance(default_storage, FileSystemStorage):
        if default_storage.exists(directory):
            shutil.rmtree(default_storage.path(directory))
    else:
        _recursive_delete(directory)
