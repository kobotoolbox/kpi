# Workaround for https://github.com/jschneier/django-storages/issues/566

import logging

import storages.backends.s3 as upstream
from django.utils.deconstruct import deconstructible


@deconstructible
class S3File(upstream.S3File):
    def __init__(self, name, mode, storage, buffer_size=None):
        super().__init__(name, mode, storage, buffer_size)
        self._remote_file_size = 0

    def seek(self, *args, **kwargs):
        logging.warning('seek() called on S3Boto3StorageFile; may break tell()')
        return super().seek(*args, **kwargs)

    def tell(self):
        return self._remote_file_size + self.file.tell()

    def _flush_write_buffer(self):
        if self._buffer_file_size:
            self._write_counter += 1
            self._remote_file_size += self._buffer_file_size
            self.file.seek(0)
            part = self._multipart.Part(self._write_counter)
            response = part.upload(Body=self.file.read())
            self._parts.append(
                {'ETag': response['ETag'], 'PartNumber': self._write_counter}
            )
            self.file.seek(0)
            self.file.truncate()


upstream.S3File = S3File


@deconstructible
class S3Boto3Storage(upstream.S3Storage):
    # Uses the overridden S3File
    pass
