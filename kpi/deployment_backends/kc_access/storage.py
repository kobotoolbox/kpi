# coding: utf-8
from django.conf import settings as django_settings
from django.core.files.storage import FileSystemStorage
from storages.backends.s3boto3 import S3Boto3Storage


def get_kobocat_storage():
    """
    Return an instance of a storage object depending on the setting
    `KOBOCAT_DEFAULT_FILE_STORAGE` value
    """
    if (
        django_settings.KOBOCAT_DEFAULT_FILE_STORAGE
        == 'storages.backends.s3boto3.S3Boto3Storage'
    ):
        return KobocatS3Boto3Storage()
    else:
        return KobocatFileSystemStorage()


class KobocatFileSystemStorage(FileSystemStorage):

    def __init__(
        self,
        location=None,
        base_url=None,
        file_permissions_mode=None,
        directory_permissions_mode=None,
    ):
        location = (
            django_settings.KOBOCAT_MEDIA_PATH if not location else location
        )
        super().__init__(
            location=location,
            base_url=base_url,
            file_permissions_mode=file_permissions_mode,
            directory_permissions_mode=directory_permissions_mode,
        )


class KobocatS3Boto3Storage(S3Boto3Storage):

    def __init__(self, acl=None, bucket=None, **settings):
        bucket = django_settings.KOBOCAT_AWS_STORAGE_BUCKET_NAME
        super().__init__(acl=None, bucket=bucket, **settings)
