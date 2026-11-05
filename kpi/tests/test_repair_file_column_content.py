from datetime import datetime, timezone
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from formpack.utils.bugfix import repair_file_column_content_in_place
from model_bakery import baker
from rest_framework import status

from kpi.models import Asset, AssetVersion
from kpi.utils.bugfix import repair_file_column_content_and_save

BEFORE_THE_BUG = datetime(2024, 1, 1, tzinfo=timezone.utc)
REPAIR_FUNCTION = 'kpi.utils.bugfix.repair_file_column_content_in_place'


def _damaged_content() -> dict:
    return {
        'schema': '1',
        'settings': {},
        'choices': [],
        'translated': ['label', 'media::file'],
        'translations': [None],
        'survey': [
            {
                'type': 'select_one_from_file',
                'name': 'q1',
                'label': ['q1'],
                'media::file': ['choices.csv'],
            }
        ],
    }


class RepairFileColumnContentTestCase(TestCase):

    def setUp(self):
        self.owner = baker.make(settings.AUTH_USER_MODEL, username='johndoe')
        self.asset = Asset.objects.create(
            owner=self.owner,
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': ['q1']}]},
        )
        self.asset.deploy(backend='mock')
        self.version = self.asset.asset_versions.filter(deployed=True).first()

    def test_damaged_asset_content_is_repaired(self):
        self._damage_asset()
        asset = Asset.objects.get(pk=self.asset.pk)

        assert repair_file_column_content_and_save(asset, include_versions=False)

        self._assert_repaired(self._stored_asset_content())
        # The instance given to the function follows the database
        self._assert_repaired(asset.content)

    def test_get_asset_detail_repairs_damaged_content(self):
        self._damage_asset()
        self.client.force_login(self.owner)

        response = self.client.get(
            reverse('api_v2:asset-detail', args=[self.asset.uid]),
            {'format': 'json'},
        )

        assert response.status_code == status.HTTP_200_OK
        self._assert_repaired(self._stored_asset_content())

    def test_healthy_asset_content_is_not_read(self):
        with patch(
            REPAIR_FUNCTION, wraps=repair_file_column_content_in_place
        ) as repair:
            assert not repair_file_column_content_and_save(
                self.asset, include_versions=False
            )

        repair.assert_not_called()

    def test_asset_modified_before_the_bug_is_not_repaired(self):
        self._damage_asset(date_modified=BEFORE_THE_BUG)
        asset = Asset.objects.get(pk=self.asset.pk)

        assert not repair_file_column_content_and_save(asset, include_versions=False)

        assert self._stored_asset_content() == _damaged_content()

    def test_every_damaged_version_is_repaired(self):
        self._damage_version(self.version)
        versions = [
            self.asset.asset_versions.create(
                version_content=_damaged_content(), deployed=True
            )
            for _ in range(2)
        ]

        assert repair_file_column_content_and_save(self.asset)

        for version in [self.version, *versions]:
            version.refresh_from_db()
            self._assert_repaired(version.version_content)

    def test_healthy_version_is_not_read(self):
        healthy_content = self.version.version_content
        damaged_version = self.asset.asset_versions.create(
            version_content=_damaged_content(), deployed=True
        )

        with patch(
            REPAIR_FUNCTION, wraps=repair_file_column_content_in_place
        ) as repair:
            assert repair_file_column_content_and_save(self.asset)

        repair.assert_called_once()
        damaged_version.refresh_from_db()
        self._assert_repaired(damaged_version.version_content)
        self.version.refresh_from_db()
        assert self.version.version_content == healthy_content

    def test_version_modified_before_the_bug_is_not_repaired(self):
        self._damage_version(self.version, date_modified=BEFORE_THE_BUG)

        assert not repair_file_column_content_and_save(self.asset)

        self.version.refresh_from_db()
        assert self.version.version_content == _damaged_content()

    def test_undeployed_version_is_not_repaired(self):
        version = self.asset.asset_versions.create(
            version_content=_damaged_content(), deployed=False
        )

        assert not repair_file_column_content_and_save(self.asset)

        version.refresh_from_db()
        assert version.version_content == _damaged_content()

    def test_versions_are_left_alone_when_excluded(self):
        self._damage_version(self.version)

        assert not repair_file_column_content_and_save(
            self.asset, include_versions=False
        )

        self.version.refresh_from_db()
        assert self.version.version_content == _damaged_content()

    def test_marker_with_nothing_to_fix_changes_nothing(self):
        content = _damaged_content()
        content['survey'] = [{'type': 'text', 'name': 'q1', 'label': ['q1']}]
        AssetVersion.objects.filter(pk=self.version.pk).update(version_content=content)

        assert not repair_file_column_content_and_save(self.asset)

        self.version.refresh_from_db()
        assert self.version.version_content == content

    def _assert_repaired(self, content: dict):
        assert content['translated'] == ['label']
        question = content['survey'][0]
        assert question['file'] == 'choices.csv'
        assert 'media::file' not in question

    def _damage_asset(self, **fields):
        Asset.objects.filter(pk=self.asset.pk).update(
            content=_damaged_content(), **fields
        )

    def _damage_version(self, version: AssetVersion, **fields):
        AssetVersion.objects.filter(pk=version.pk).update(
            version_content=_damaged_content(), **fields
        )

    def _stored_asset_content(self) -> dict:
        return Asset.objects.values_list('content', flat=True).get(pk=self.asset.pk)
