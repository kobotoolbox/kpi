from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase

from kpi.models.asset import Asset
from kpi.models.asset_file import AssetFile


class ExtendedFileFieldTestCase(TestCase):

    fixtures = ['test_data']

    def test_move_file(self):
        # Use AssetFile but could not any model which uses `ExtendedFileField`
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
