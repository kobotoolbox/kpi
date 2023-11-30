import os

from django.db.models import FileField
from django.db.models.fields.files import FieldFile
from storages.backends.s3boto3 import S3Boto3Storage


class ExtendedFieldFile(FieldFile):

    def move(self, target_folder: str):

        old_path = self.name
        filename = os.path.basename(old_path)
        new_path = f'{target_folder}/{filename}'

        if isinstance(self.storage, S3Boto3Storage):
            copy_source = {
                'Bucket': self.storage.bucket.name,
                'Key': self.name
            }
            self.storage.bucket.copy(copy_source, new_path)
            self.storage.delete(old_path)
            self.name = new_path
        else:
            with self.storage.open(old_path, 'rb') as f:
                self.save(new_path, f, save=False)
            self.storage.delete(old_path)


class ExtendedFileField(FileField):

    attr_class = ExtendedFieldFile


class PrivateExtendedFileField(ExtendedFileField):

    pass
