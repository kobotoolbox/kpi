import json
from copy import deepcopy
from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from formpack.utils.expand_content import SCHEMA_VERSION
from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import BadAssetTypeException
from kpi.utils.hash import calculate_hash
from ..models import Asset, AssetVersion


class AssetVersionTestCase(TestCase):
    def test_init_asset_version(self):
        av_count = AssetVersion.objects.count()
        _content = {
                'survey': [
                    {'type': 'note',
                     'label': 'Read me',
                     'name': 'n1'}
                ],
            }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        _vc = deepcopy(new_asset.latest_version.version_content)
        pop_atts = [
            '$kuid',
            '$autoname',
            '$prev',
            '$xpath',
        ]
        for row in _vc['survey']:
            for att in pop_atts:
                row.pop(att, None)
        self.assertEqual(_vc, {
                'survey': [
                    {'type': 'note',
                     'label': ['Read me'],
                     'name': 'n1'},
                ],
                'schema': SCHEMA_VERSION,
                'translated': ['label'],
                'translations': [None],
                'settings': {},
            })
        self.assertEqual(av_count + 1, AssetVersion.objects.count())
        new_asset.content['survey'].append({'type': 'note',
                                            'label': 'Read me 2',
                                            'name': 'n2'})
        new_asset.save()
        self.assertEqual(av_count + 2, AssetVersion.objects.count())

    def test_asset_deployment(self):
        bob = User.objects.create(username='bob')
        self.asset = Asset.objects.create(
            asset_type='survey',
            content={'survey': [{'type': 'note', 'label': ['Read me'], 'name': 'n1'}]},
            owner=bob,
        )
        self.assertEqual(self.asset.asset_versions.count(), 1)
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.content['survey'].append(
            {'type': 'note', 'label': ['Read me 2'], 'name': 'n2'}
        )
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)
        v2 = self.asset.latest_version
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.deploy(backend='mock', active=True)
        self.asset.save(create_version=False, adjust_content=False)
        # version did not increment
        self.assertEqual(self.asset.asset_versions.count(), 2)

        # v2 now has 'deployed=True'
        v2_ = AssetVersion.objects.get(uid=v2.uid)
        self.assertEqual(v2_.deployed, True)

    def test_template_asset_deployment(self):
        self.template_asset = Asset.objects.create(asset_type='template')
        self.assertEqual(self.template_asset.asset_versions.count(), 1)
        self.assertEqual(self.template_asset.latest_version.deployed, False)
        self.template_asset.save()
        self.assertEqual(self.template_asset.asset_versions.count(), 2)
        self.assertEqual(self.template_asset.latest_version.deployed, False)

        def _bad_deployment():
            self.template_asset.deploy(backend='mock', active=True)

        self.assertRaises(BadAssetTypeException, _bad_deployment)

    def test_version_content_hash(self):
        _content = {
            'survey': [
                {'type': 'note',
                 'label': 'Read me',
                 'name': 'n1'}
            ],
        }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        expected_hash = calculate_hash(
            json.dumps(new_asset.content, sort_keys=True), 'sha1'
        )
        self.assertEqual(new_asset.latest_version.content_hash, expected_hash)
        return new_asset

    def test_version_content_hash_same_after_non_content_change(self):
        new_asset = self.test_version_content_hash()
        expected_hash = new_asset.latest_version.content_hash
        new_asset.settings['description'] = 'Loco el que lee'
        new_asset.save()
        self.assertEqual(new_asset.latest_version.content_hash, expected_hash)

    def test_version_date_modified(self):
        date_forced = datetime(2022, 1, 1, 0, 0, 0, tzinfo=ZoneInfo('UTC'))
        content = {
            'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}],
        }
        new_asset = Asset.objects.create(
            asset_type='survey',
            content=content,
            date_created=date_forced,
            date_modified=date_forced,
        )
        AssetVersion.objects.filter(uid=new_asset.latest_version.uid).update(
            date_modified=date_forced
        )
        new_asset.refresh_from_db()
        assert new_asset.latest_version.date_modified == date_forced
        now = timezone.now()
        new_asset.latest_version.save()
        assert new_asset.latest_version.date_modified != date_forced
        assert new_asset.latest_version.date_modified >= now
