import os
import posixpath

from django.db.models import FileField
from django.db.models.fields.files import FieldFile
from storages.backends.s3 import ClientError, S3Storage

from kpi.utils.log import logging


class ExtendedFieldFile(FieldFile):

    def move(self, target_folder: str, reraise_errors: bool = False) -> bool:

        old_path = self.name
        filename = os.path.basename(old_path)
        new_path = f'{target_folder}/{filename}'

        if isinstance(self.storage, S3Storage):
            copy_source = {
                'Bucket': self.storage.bucket.name,
                'Key': self.name,
            }
            try:
                self.storage.bucket.copy(copy_source, new_path)
                self.storage.delete(old_path)
            except ClientError as e:
                logging.error(
                    f'Error copying {old_path} to {new_path}: {e}', exc_info=True
                )
                if reraise_errors:
                    raise e
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
        except FileNotFoundError as fe:
            logging.error(fe, exc_info=True)
            if reraise_errors:
                raise fe
        finally:
            # Restore `upload_to`
            self.field.upload_to = upload_to

        return success


class ExtendedFileField(FileField):

    attr_class = ExtendedFieldFile


class PrivateExtendedFileField(ExtendedFileField):

    pass
