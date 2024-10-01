import os
import posixpath

from django.db.models import FileField
from django.db.models.fields.files import FieldFile
from storages.backends.s3 import ClientError, S3Storage


class ExtendedFieldFile(FieldFile):

    def move(self, target_folder: str):

        old_path = self.name
        filename = os.path.basename(old_path)
        new_path = f'{target_folder}/{filename}'

        if isinstance(self.storage, S3Storage):
            copy_source = {
                'Bucket': self.storage.bucket.name,
                'Key': self.name
            }
            try:
                self.storage.bucket.copy(copy_source, new_path)
                self.storage.delete(old_path)
            except ClientError:
                return False

            self.name = new_path
            return True

        upload_to = self.field.upload_to
        # Temporary change `upload_to` - which is called internally by
        # `self.save()` below - to new target folder
        self.field.upload_to = lambda i, fn: posixpath.join(target_folder, fn)
        success = False
        try:
            with self.storage.open(old_path, 'rb') as f:
                self.save(filename, f, save=False)
            self.storage.delete(old_path)
            success = True
        except FileNotFoundError:
            pass
        finally:
            # Restore `upload_to`
            self.field.upload_to = upload_to

        return success


class ExtendedFileField(FileField):

    attr_class = ExtendedFieldFile


class PrivateExtendedFileField(ExtendedFileField):

    pass
