#!/usr/bin/python
# -*- coding: utf-8 -*-

from django.test import TestCase
from kpi.models.asset import Asset

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
        self.assertEqual(self.asset.deployment_data['backend'], 'mock')


class MockDeployment(TestCase):
    def setUp(self):
        self.asset = Asset.objects.create(content={
            'survey': [
                {u'type':'text', u'name': 'q1',
                    u'label': 'Q1.',}
                ]
            })
        self.asset.connect_deployment(backend='mock')

    def test_deployment_creates_identifier(self):
        _uid = self.asset.uid
        self.assertEqual(self.asset.deployment_data['identifier'], 'mock://%s' % _uid)

    def test_deployment_starts_out_inactive(self):
        self.assertEqual(self.asset.deployment_data['active'], False)

    def test_set_active(self):
        self.asset.deployment.set_active(True)
        self.assertEqual(self.asset.deployment_data['active'], True)

        self.asset.deployment.set_active(False)
        self.assertEqual(self.asset.deployment_data['active'], False)
