from ddt import data, ddt
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase

from kpi.exceptions import SourceFileMissingError
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
            # delete the actual stored file to force a "source missing" error
            default_storage.delete(path)

            if reraise_errors:
                # A gone source is now surfaced as `SourceFileMissingError`
                # for both S3 (NoSuchKey/404) and local (FileNotFoundError).
                with self.assertRaises(SourceFileMissingError):
                    asset_file.content.move('__pytest_moved', reraise_errors=True)
            else:
                assert not asset_file.content.move('__pytest_moved')
            # make sure we restored `upload_to`
            assert asset_file.content.field.upload_to == upload_to
        finally:
            if default_storage.exists(path):
                default_storage.delete(path)

    def test_move_reraises_source_missing_for_s3_nosuchkey(self):
        from unittest.mock import MagicMock, patch

        from botocore.exceptions import ClientError

        asset = Asset.objects.get(pk=1)
        asset_file = AssetFile(
            asset=asset, user=asset.owner, file_type=AssetFile.FORM_MEDIA
        )
        asset_file.content = ContentFile(b'foo', name='foo.txt')
        asset_file.save()

        error = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'gone'}}, 'CopyObject'
        )
        fake_storage = MagicMock()
        fake_storage.bucket.name = 'test-bucket'
        fake_storage.bucket.copy.side_effect = error

        try:
            with patch(
                'kpi.fields.file.is_s3_storage', return_value=True
            ), patch.object(asset_file.content, 'storage', fake_storage):
                with self.assertRaises(SourceFileMissingError):
                    asset_file.content.move('__pytest_moved', reraise_errors=True)
        finally:
            path = f'someuser/asset_files/{asset.uid}/form_media/foo.txt'
            if default_storage.exists(path):
                default_storage.delete(path)

    def test_move_reraises_source_missing_for_azure_resource_not_found(self):
        # Azure signals a missing blob with its own exception, so it needs the
        # same treatment as S3 and the filesystem.
        from unittest.mock import MagicMock, patch

        from azure.core.exceptions import ResourceNotFoundError

        asset = Asset.objects.get(pk=1)
        asset_file = AssetFile(
            asset=asset, user=asset.owner, file_type=AssetFile.FORM_MEDIA
        )
        asset_file.content = ContentFile(b'foo', name='foo.txt')
        asset_file.save()

        fake_storage = MagicMock()
        fake_storage.open.side_effect = ResourceNotFoundError('gone')

        try:
            with patch.object(asset_file.content, 'storage', fake_storage):
                with self.assertRaises(SourceFileMissingError):
                    asset_file.content.move('__pytest_moved', reraise_errors=True)
        finally:
            path = f'someuser/asset_files/{asset.uid}/form_media/foo.txt'
            if default_storage.exists(path):
                default_storage.delete(path)
