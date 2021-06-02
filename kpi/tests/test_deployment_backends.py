# coding: utf-8
import pytest
from django.test import TestCase

from kpi.exceptions import DeploymentDataException
from kpi.models.asset import Asset
from kpi.models.asset_version import AssetVersion


class CreateDeployment(TestCase):
    def setUp(self):
        self.asset = Asset(content={
            'survey': [
                {'type':'text', 'name': 'q1',
                    'label': 'Q1.',}
                ]
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
        self.assertEqual(self.asset.deployment.backend, 'mock')


@pytest.mark.django_db
def test_initial_kuids():
    initial_kuid = 'aaaa1111'
    asset = Asset.objects.create(content={
        'survey': [
            {'type': 'text',
                'name': 'q1',
                'label': 'Q1.',
                '$kuid': initial_kuid,
             }
            ]
        })
    assert asset.content['survey'][0]['$kuid'] == initial_kuid

    asset.deploy(backend='mock', active=False)
    asset.save()
    assert '$kuid' in asset.content['survey'][0]
    second_kuid = asset.content['survey'][0]['$kuid']
    assert asset.content['survey'][0]['$kuid'] == initial_kuid


class MockDeployment(TestCase):
    def setUp(self):
        self.asset = Asset.objects.create(content={
            'survey': [
                {'type': 'text', 'name': 'q1',
                    'label': 'Q1.'
                 }
                ]
            })
        self.asset.deploy(backend='mock', active=False)
        self.asset.save()

    def test_deployment_creates_identifier(self):
        _uid = self.asset.uid
        self.assertEqual(self.asset.deployment.identifier, 'mock://%s' % _uid)

    def test_deployment_starts_out_inactive(self):
        self.assertEqual(self.asset.deployment.active, False)

    def test_set_active(self):
        self.asset.deployment.set_active(True)
        self.asset.save()
        self.assertEqual(self.asset.deployment.active, True)

        self.asset.deployment.set_active(False)
        self.asset.save()
        self.assertEqual(self.asset.deployment.active, False)

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
        self.assertEqual(self.asset.deployment.active, False)

    def test_delete(self):
        self.assertTrue(self.asset.has_deployment)
        self.asset.deployment.delete()
        self.assertFalse(self.asset.has_deployment)

    def test_get_not_mutable_deployment_data(self):
        deployment_data = self.asset.deployment.get_data()
        original_identifier = deployment_data['identifier']
        deployment_data['identifier'] = 'mock://test'
        # self.asset._deployment_data should have been touched

        # Check that original identifier still the same
        self.assertEqual(self.asset.deployment.identifier,
                         original_identifier)

        # Check that identifier has not been altered in deployment data
        other_deployment_data = self.asset.deployment.get_data()
        self.assertEqual(other_deployment_data['identifier'],
                         original_identifier)

    def test_save_to_db_with_quote(self):
        new_key = 'dummy'
        new_value = "I'm in love with Apostrophe"
        self.asset.deployment.save_to_db({new_key: new_value})
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.deployment.get_data(new_key), new_value)

    def test_save_data(self):

        deployment_data = self.asset.deployment.get_data()
        self.asset._deployment_data['direct_access'] = True  # noqa
        # We should not be able to save asset when `_deployment_data` has been
        # altered directly
        with self.assertRaises(DeploymentDataException) as e:
            self.asset.save()

        self.asset.refresh_from_db()
        self.assertEqual(self.asset._deployment_data, deployment_data)

        # Using the deployment should work
        self.asset.deployment.store_data({'direct_access': True})
        self.asset.save()
        self.asset.refresh_from_db()
        self.assertNotEqual(self.asset._deployment_data, deployment_data)  # noqa
        self.assertTrue(self.asset._deployment_data['direct_access'])  # noqa

    def test_save_data_with_deferred_fields(self):
        # It should work with deferred fields too
        asset = Asset.objects.only('uid').get(id=self.asset.pk)
        asset._deployment_data = {'overwrite_all': True}  # noqa
        # Hidden field copy has not been set yet
        self.assertTrue(asset._Asset__deployment_data_copy is None)  # noqa
        # We should not be able to save asset when `_deployment_data` has been
        # altered directly
        with self.assertRaises(DeploymentDataException) as e:
            asset.save()
