# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import unittest

from django.test import TestCase
from django.conf import settings

from kobo.apps.reports import report_data


class FakeMongoDB(object):
    '''
    A fake Mongo connection that supports one collection, `instances`, and one
    method on that collection, `find()`, which returns the fake query results
    provided to the constructor. Example:
        FakeMongoDB(static_results_list).instances.find(ignored_query) ->
            static_results_list
    '''
    class FakeMongoCollection(object):
        def __init__(self, fake_query_results):
            self.fake_query_results = fake_query_results
        def find(self, *args, **kwargs):
            return self.fake_query_results
    def __init__(self, fake_query_results):
        self.instances = FakeMongoDB.FakeMongoCollection(fake_query_results)


class MongoBase64Decoding(TestCase):
    '''
    MongoDB does not support dots in key names, so KC encodes them using
    Base64. Verify that KPI decodes these as expected when reading from MongoDB
    '''
    def setUp(self):
        self.maxDiff = None
        self.original_mongo_db = settings.MONGO_DB
        self.encoded_results = [{
            u'__version__': u'vPtjMxE37b4kgqoCBFEkeb',
            u'_attachments': [],
            u'_bamboo_dataset_id': u'',
            u'_geolocation': [None, None],
            u'_id': 190,
            u'_notes': [],
            u'_status': u'submitted_via_web',
            u'_submission_time': u'2017-12-20T07:19:38',
            u'_submitted_by': None,
            u'_tags': [],
            u'_userform_id': u'someuser_afgNxNby4VxHJ4STM2LmVz',
            u'_uuid': u'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            u'_xform_id_string': u'afgNxNby4VxHJ4STM2LmVz',
            u'dotLg==dotLg==dot': u'<<< THIS IS THE IMPORTANT ONE!!!',
            u'formhub/uuid': u'c1aae157497d477aa3443b2ca9306e2e',
            u'meta/instanceID': u'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            u'regular': u'1.3'
        }]
        self.decoded_results = [{
            u'__version__': u'vPtjMxE37b4kgqoCBFEkeb',
            u'_attachments': [],
            u'_bamboo_dataset_id': u'',
            u'_geolocation': [None, None],
            u'_id': 190,
            u'_notes': [],
            u'_status': u'submitted_via_web',
            u'_submission_time': u'2017-12-20T07:19:38',
            u'_submitted_by': None,
            u'_tags': [],
            u'_userform_id': u'someuser_afgNxNby4VxHJ4STM2LmVz',
            u'_uuid': u'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            u'_xform_id_string': u'afgNxNby4VxHJ4STM2LmVz',
            u'dot.dot.dot': u'<<< THIS IS THE IMPORTANT ONE!!!',
            u'formhub/uuid': u'c1aae157497d477aa3443b2ca9306e2e',
            u'meta/instanceID': u'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            u'regular': u'1.3'
        }]
        settings.MONGO_DB = FakeMongoDB(self.encoded_results)

    def tearDown(self):
        settings.MONGO_DB = self.original_mongo_db

    def test_decoding_base64_dots(self):
        decoded = list(report_data.get_instances_for_userform_id(
            '_userform_id is ignored by FakeMongoDB'))
        expected_results = self.decoded_results
        self.assertEqual(decoded, expected_results)
