from django.contrib.auth.models import User
from django.test import TestCase

from kpi.constants import ASSET_TYPE_SURVEY
from ..models import Asset, AssetExportSettings


class AssetExportSettingsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(
            asset_type=ASSET_TYPE_SURVEY, owner=self.someuser
        )
        self.asset_export_settings = AssetExportSettings.objects.filter(
            asset=self.asset
        )
        self.name = 'foo'
        self.valid_export_settings = {
            'fields_from_all_versions': 'true',
            'group_sep': '/',
            'hierarchy_in_labels': 'true',
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'csv',
        }

    def _create_foo_export_settings(self):
        return AssetExportSettings.objects.create(
            asset=self.asset,
            name=self.name,
            export_settings=self.valid_export_settings,
        )

    def test_create_export_settings(self):
        inital_es_count = self.asset_export_settings.count()
        assert inital_es_count == 0

        _export_settings = self._create_foo_export_settings()
        assert self.asset_export_settings.count() == 1
        settings = self.asset_export_settings.get(uid=_export_settings.uid)
        assert settings.name == self.name
        assert str(settings) == f'{self.name} {_export_settings.uid}'

    def test_update_export_settings(self):
        _export_settings = self._create_foo_export_settings()

        new_name = 'bar'
        _export_settings.name = new_name
        assert _export_settings.name == new_name

        new_export_settings = {**self.valid_export_settings, 'type': 'xls'}
        _export_settings.export_settings = new_export_settings
        assert _export_settings.export_settings['type'] == 'xls'

    def test_delete_export_settings(self):
        _export_settings = self._create_foo_export_settings()
        assert self.asset_export_settings.count() == 1
        settings = self.asset_export_settings.get(uid=_export_settings.uid)
        settings.delete()
        assert self.asset_export_settings.count() == 0

