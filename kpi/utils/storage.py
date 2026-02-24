import os
import shutil
from typing import Iterable

from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage
from kobo.apps.storage_backends.s3boto3 import S3Boto3Storage
from storages.backends.azure_storage import AzureStorage


def bulk_rmdir(directories: Iterable[str], storage: Storage) -> None:
    """
    Delete multiple directories and all their contents from storage.

    Unlike calling rmdir() in a loop, this function uses backend-specific
    bulk APIs to minimise the number of network round-trips:

    * FileSystemStorage – shutil.rmtree() per directory.
    * S3Boto3Storage    – lists objects under each prefix and deletes them
                          in batches of 1 000 with delete_objects().
    * AzureStorage      – lists blobs under each prefix and deletes them
                          in batches of 256 with delete_blobs().

    ``directories`` must contain paths relative to the storage root
    (same convention as rmdir()).
    """

    if not directories:
        return

    if isinstance(storage, FileSystemStorage):
        for directory in directories:
            full_path = storage.path(directory)
            if os.path.exists(full_path):
                shutil.rmtree(full_path)

    elif isinstance(storage, S3Boto3Storage):
        _bulk_rmdir_s3(directories, storage)

    elif isinstance(storage, AzureStorage):
        _bulk_rmdir_azure(directories, storage)

    else:
        for directory in directories:
            rmdir(directory, storage, storage)


def rmdir(directory: str, storage: Storage):
    """
    Delete `directory` (and recursively all files and folders inside it).
    `directory` location must be relative to default storage.
    """
    def _recursive_delete(path):
        directories, files = storage.listdir(path)
        for file_ in files:
            storage.delete(os.path.join(path, file_))
        for directory_ in directories:
            _recursive_delete(os.path.join(path, directory_))

    if isinstance(storage, FileSystemStorage):
        if storage.exists(directory):
            shutil.rmtree(storage.path(directory))
    else:
        _recursive_delete(directory)

def _bulk_rmdir_s3(directories: list[str], storage: S3Boto3Storage) -> None:
    """Delete S3 objects whose keys fall under any of the given prefixes."""
    bucket = storage.bucket
    location = getattr(storage, 'location', '').strip('/')
    pending: list[dict] = []

    def _flush(keys: list[dict]) -> None:
        bucket.delete_objects(Delete={'Objects': keys, 'Quiet': True})

    for directory in directories:
        dir_path = directory.strip('/')
        prefix = f'{location}/{dir_path}/' if location else f'{dir_path}/'
        for obj in bucket.objects.filter(Prefix=prefix):
            pending.append({'Key': obj.key})
            if len(pending) == settings.S3_DELETE_BATCH_SIZE:
                _flush(pending)
                pending = []

    if pending:
        _flush(pending)


def _bulk_rmdir_azure(directories: list[str], storage: AzureStorage) -> None:
    """Delete Azure blobs whose names fall under any of the given prefixes."""
    container_client = storage.client
    location = getattr(storage, 'location', '').strip('/')
    pending: list[str] = []

    def _flush(names: list[str]) -> None:
        container_client.delete_blobs(*names)

    for directory in directories:
        dir_path = directory.strip('/')
        prefix = f'{location}/{dir_path}/' if location else f'{dir_path}/'
        for blob in container_client.list_blobs(name_starts_with=prefix):
            pending.append(blob['name'])
            if len(pending) == settings.AZURE_DELETE_BATCH_SIZE:
                _flush(pending)
                pending = []

    if pending:
        _flush(pending)
