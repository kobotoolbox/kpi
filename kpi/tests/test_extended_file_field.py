from botocore.exceptions import ClientError
from ddt import data, ddt
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase

from kobo.apps.storage_backends.s3boto3 import S3Boto3Storage
from kpi.models.asset import Asset
from kpi.models.asset_file import AssetFile


@ddt
class ExtendedFileFieldTestCase(TestCase):

    fixtures = ['test_data']

    def test_move_file(self):
        # Use AssetFile but could be any model which uses `ExtendedFileField`
        asset = Asset.objects.get(pk=1)
        asset_file = AssetFile(
            asset=asset, user=asset.owner, file_type=AssetFile.FORM_MEDIA
        )
        asset_file.content = ContentFile(b'foo', name='foo.txt')
        asset_file.save()
        path = f'someuser/asset_files/{asset.uid}/form_media/foo.txt'
        new_path = f'__pytest_moved/foo.txt'

        try:
            assert default_storage.exists(path)
            assert not default_storage.exists(new_path)
            asset_file.content.move('__pytest_moved')
            assert not default_storage.exists(path)
            assert default_storage.exists(new_path)

            with default_storage.open(new_path, 'r') as f:
                assert f.read() == 'foo'
        finally:
            # Clean-up
            if default_storage.exists(path):
                default_storage.delete(path)
            if default_storage.exists(new_path):
                default_storage.delete(new_path)

    @data(True, False)
    def test_move_file_reraise_errors(self, reraise_errors):
        asset = Asset.objects.get(pk=1)
        asset_file = AssetFile(
            asset=asset, user=asset.owner, file_type=AssetFile.FORM_MEDIA
        )
        asset_file.content = ContentFile(b'foo', name='foo.txt')
        asset_file.save()
        path = f'someuser/asset_files/{asset.uid}/form_media/foo.txt'
        upload_to = asset_file.content.field.upload_to
        try:
            # delete the actual stored file to force a file not found error
            default_storage.delete(path)

            ErrorClass = (
                ClientError
                if isinstance(default_storage, S3Boto3Storage)
                else FileNotFoundError
            )
            if reraise_errors:
                with self.assertRaises(ErrorClass):
                    asset_file.content.move('__pytest_moved', reraise_errors=True)
            else:
                assert not asset_file.content.move('__pytest_moved')
            # make sure we restored `upload_to`
            assert asset_file.content.field.upload_to == upload_to
        finally:
            if default_storage.exists(path):
                default_storage.delete(path)
