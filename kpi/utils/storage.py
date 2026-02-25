import os
import shutil
from typing import Iterable

from azure.storage.blob import PartialBatchErrorException
from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage
from storages.backends.azure_storage import AzureStorage
from rest_framework import status

from kobo.apps.storage_backends.s3boto3 import S3Boto3Storage


def bulk_delete_files(file_paths: Iterable[str], storage: Storage) -> None:
    """
    Delete specific files from storage using backend-specific bulk APIs.

    Unlike a directory-based approach, this function takes exact file paths
    and deletes them directly without any listing step, which is much faster
    when the paths are already known.

    * FileSystemStorage – os.remove() per file.
    * S3Boto3Storage    – deletes files in batches of 1 000 with delete_objects().
    * AzureStorage      – deletes files in batches of 256 with delete_blobs().

    ``file_paths`` must contain paths relative to the storage root.
    """
    if not file_paths:
        return

    if isinstance(storage, FileSystemStorage):
        parent_dirs = {os.path.dirname(p) for p in file_paths if p}
        for directory in parent_dirs:
            rmdir(directory, storage)

    elif isinstance(storage, S3Boto3Storage):
        _bulk_delete_files_s3(file_paths, storage)

    elif isinstance(storage, AzureStorage):
        _bulk_delete_files_azure(file_paths, storage)

    else:
        for path in file_paths:
            storage.delete(path)


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


def _bulk_delete_files_s3(file_paths: Iterable[str], storage: S3Boto3Storage) -> None:
    """
    Delete S3 objects by exact key, with no listing step.
    """
    bucket = storage.bucket
    location = getattr(storage, 'location', '').strip('/')
    pending: list[dict] = []

    def _flush(keys: list[dict]) -> None:
        bucket.delete_objects(Delete={'Objects': keys, 'Quiet': True})

    for path in file_paths:
        path = path.strip('/')
        key = f'{location}/{path}' if location else path
        pending.append({'Key': key})
        if len(pending) == settings.S3_DELETE_BATCH_SIZE:
            _flush(pending)
            pending = []

    if pending:
        _flush(pending)


def _bulk_delete_files_azure(file_paths: Iterable[str], storage: AzureStorage):
    """
    Delete Azure blobs by exact name, with no listing step.
    """
    container_client = storage.client
    location = getattr(storage, 'location', '').strip('/')
    pending: list[str] = []

    def _flush(names: list[str]):
        try:
            container_client.delete_blobs(*names)
        except PartialBatchErrorException as e:
            # Ignore 200/202 (success) and 404 (already deleted), re-raise for real
            # errors.
            real_errors = [
                r
                for r in e.parts
                if r.status_code
                not in (
                    status.HTTP_200_OK,
                    status.HTTP_202_ACCEPTED,
                    status.HTTP_404_NOT_FOUND,
                )
            ]
            if real_errors:
                raise

    for path in file_paths:
        path = path.strip('/')
        name = f'{location}/{path}' if location else path
        pending.append(name)
        if len(pending) == settings.AZURE_DELETE_BATCH_SIZE:
            _flush(pending)
            pending = []

    if pending:
        _flush(pending)
