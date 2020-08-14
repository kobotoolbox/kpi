# coding: utf-8
import pytest
from django.test import TestCase

from kpi.models.asset import Asset
from kpi.models.asset_version import AssetVersion


class CreateDeployment(TestCase):
    def setUp(self):
        self.asset = Asset(content={
            'schema': '2',
            'survey': [
                    {'type':'text',
                     'name': 'q1',
                     '$anchor': 'kq1k',
                     'label': {'tx0': 'Q1.'},
                }
            ],
            'translations': [{'$anchor': 'tx0', 'name': ''}]
        })

    def test_invalid_backend_fails(self):
        self.asset.save()

        def _bad_deployment():
            self.asset.connect_deployment(backend='nonexistent')
        self.assertRaises(KeyError, _bad_deployment)

    def test_mock_deployment_inits(self):
        self.asset.save()
        _uid = self.asset.uid
        self.asset.connect_deployment(backend='mock')
        self.assertEqual(self.asset._deployment_data['backend'], 'mock')


@pytest.mark.django_db
def test_initial_kuids():
    ANCHOR_KEY = '$anchor'
    initial_kuid = 'aaaa1111'
    asset = Asset.objects.create(content={
        'schema': '2',
        'survey': [
                {'type':'text',
                 'name': 'q1',
                 ANCHOR_KEY: initial_kuid,
                 'label': {'tx0': 'Q1.'},
            }
        ],
        'translations': [{ANCHOR_KEY: 'tx0', 'name': ''}]
    })
    assert asset.content['survey'][0][ANCHOR_KEY] == initial_kuid

    asset.deploy(backend='mock', active=False)
    asset.save()
    assert ANCHOR_KEY in asset.content['survey'][0]
    second_kuid = asset.content_v2['survey'][0][ANCHOR_KEY]
    assert asset.content['survey'][0][ANCHOR_KEY] == initial_kuid


class MockDeployment(TestCase):
    def setUp(self):
        self.asset = Asset.objects.create(content={'choices': {},
            'metas': {},
            'schema': '2',
            'settings': {},
            'survey': [{'$anchor': 'q1q1',
                        'label': {'tx0': 'Q1.'},
                        'name': 'q1',
                        'type': 'text'}],
            'translations': [{'$anchor': 'tx0', 'name': ''}]
        })
        self.asset.deploy(backend='mock', active=False)
        self.asset.save()

    def test_deployment_creates_identifier(self):
        _uid = self.asset.uid
        self.assertEqual(self.asset._deployment_data['identifier'], 'mock://%s' % _uid)

    def test_deployment_starts_out_inactive(self):
        self.assertEqual(self.asset._deployment_data['active'], False)

    def test_set_active(self):
        self.asset.deployment.set_active(True)
        self.asset.save()
        self.assertEqual(self.asset._deployment_data['active'], True)

        self.asset.deployment.set_active(False)
        self.asset.save()
        self.assertEqual(self.asset._deployment_data['active'], False)

    def test_redeploy(self):
        av_count_0 = AssetVersion.objects.count()
        _v1_uid = self.asset.latest_version.uid
        self.asset.deployment.set_active(True)
        av_count_1 = AssetVersion.objects.count()
        _v2_uid = self.asset.latest_version.uid

        # version should not have changed

        self.assertEqual(av_count_0, av_count_1)
        self.assertEqual(_v1_uid, _v2_uid)
        # self.assertEqual(self.asset.latest_deployed_version.uid, _v2_uid)

        self.asset.deployment.set_active(False)
        self.assertEqual(self.asset._deployment_data['active'], False)

    def test_delete(self):
        self.assertTrue(self.asset.has_deployment)
        self.asset.deployment.delete()
        self.assertFalse(self.asset.has_deployment)
