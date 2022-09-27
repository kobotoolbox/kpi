# Workaround for https://github.com/jschneier/django-storages/issues/566

import logging

from storages.backends.s3boto3 import S3Boto3Storage as BaseS3Boto3Storage
from storages.backends.s3boto3 import \
    S3Boto3StorageFile as BaseS3Boto3StorageFile


class S3Boto3StorageFile(BaseS3Boto3StorageFile):
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
            self._parts.append({
                'ETag': response['ETag'],
                'PartNumber': self._write_counter
            })
            self.file.seek(0)
            self.file.truncate()


class S3Boto3Storage(BaseS3Boto3Storage):
    def _open(self, name, mode='rb'):
        name = self._normalize_name(self._clean_name(name))
        try:
            f = S3Boto3StorageFile(name, mode, self)
        except ClientError as err:
            if err.response['ResponseMetadata']['HTTPStatusCode'] == 404:
                raise FileNotFoundError('File does not exist: %s' % name)
            raise  # Let it bubble up if it was some other error
        return f
