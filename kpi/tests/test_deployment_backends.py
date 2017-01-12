#!/usr/bin/python
# -*- coding: utf-8 -*-

from django.test import TestCase
from kpi.models.asset import Asset
from kpi.models.asset_version import AssetVersion


class CreateDeployment(TestCase):
    def setUp(self):
        self.asset = Asset(content={
            'survey': [
                {u'type':'text', u'name': 'q1',
                    u'label': 'Q1.',}
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
        self.assertEqual(self.asset._deployment_data['backend'], 'mock')


class MockDeployment(TestCase):
    def setUp(self):
        self.asset = Asset.objects.create(content={
            'survey': [
                {u'type': 'text', u'name': 'q1',
                    u'label': 'Q1.'
                 }
                ]
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
