# coding: utf-8
from django.conf import settings
from django.test import TestCase

from kpi.utils.mongo_helper import MongoHelper


def get_instances_from_mongo():
    # TODO: remove this as we no longer use `_deleted_at`
    query = {'_deleted_at': {'$exists': False}}
    instances = settings.MONGO_DB.instances.find(query)
    return (
        MongoHelper.to_readable_dict(instance) for instance in instances
    )


class FakeMongoDB:
    """
    A fake Mongo connection that supports one collection, `instances`, and one
    method on that collection, `find()`, which returns the fake query results
    provided to the constructor. Example:
        FakeMongoDB(static_results_list).instances.find(ignored_query) ->
            static_results_list
    """
    class FakeMongoCollection:
        def __init__(self, fake_query_results):
            self.fake_query_results = fake_query_results

        def find(self, *args, **kwargs):
            return self.fake_query_results

    def __init__(self, fake_query_results):
        self.instances = FakeMongoDB.FakeMongoCollection(fake_query_results)


class MongoBase64Decoding(TestCase):
    """
    MongoDB does not support dots in key names, so KC encodes them using
    Base64. Verify that KPI decodes these as expected when reading from MongoDB
    """
    def setUp(self):
        self.maxDiff = None
        self.original_mongo_db = settings.MONGO_DB

    def tearDown(self):
        settings.MONGO_DB = self.original_mongo_db

    def test_decoding_base64_dots(self):
        encoded_results = [{
            '__version__': 'vPtjMxE37b4kgqoCBFEkeb',
            '_attachments': [],
            '_bamboo_dataset_id': '',
            '_geolocation': [None, None],
            '_id': 190,
            '_notes': [],
            '_status': 'submitted_via_web',
            '_submission_time': '2017-12-20T07:19:38',
            '_submitted_by': None,
            '_tags': [],
            '_userform_id': 'someuser_afgNxNby4VxHJ4STM2LmVz',
            '_uuid': 'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            '_xform_id_string': 'afgNxNby4VxHJ4STM2LmVz',
            'dotLg==dotLg==dot': '<<< THIS IS THE IMPORTANT ONE!!!',
            'formhub/uuid': 'c1aae157497d477aa3443b2ca9306e2e',
            'meta/instanceID': 'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            'regular': '1.3'
        }]
        decoded_results = [{
            '__version__': 'vPtjMxE37b4kgqoCBFEkeb',
            '_attachments': [],
            '_bamboo_dataset_id': '',
            '_geolocation': [None, None],
            '_id': 190,
            '_notes': [],
            '_status': 'submitted_via_web',
            '_submission_time': '2017-12-20T07:19:38',
            '_submitted_by': None,
            '_tags': [],
            '_userform_id': 'someuser_afgNxNby4VxHJ4STM2LmVz',
            '_uuid': 'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            '_xform_id_string': 'afgNxNby4VxHJ4STM2LmVz',
            'dot.dot.dot': '<<< THIS IS THE IMPORTANT ONE!!!',
            'formhub/uuid': 'c1aae157497d477aa3443b2ca9306e2e',
            'meta/instanceID': 'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            'regular': '1.3'
        }]
        settings.MONGO_DB = FakeMongoDB(encoded_results)
        decoded = list(get_instances_from_mongo())
        expected_results = decoded_results
        self.assertEqual(decoded, expected_results)

    def test_decoding_base64_dots_in_repeating_groups(self):
        encoded_results = [{
            '__version__': 'vPtjMxE37b4kgqoCBFEkeb',
            '_attachments': [],
            '_bamboo_dataset_id': '',
            '_geolocation': [None, None],
            '_id': 190,
            '_notes': [],
            '_status': 'submitted_via_web',
            '_submission_time': '2017-12-20T07:19:38',
            '_submitted_by': None,
            '_tags': [],
            '_userform_id': 'someuser_afgNxNby4VxHJ4STM2LmVz',
            '_uuid': 'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            '_xform_id_string': 'afgNxNby4VxHJ4STM2LmVz',
            # Important portion follows #
            'dottyLg==dotLg==group': [
                {
                  'dottyLg==dotLg==group/dottyLg==dotLg==inLg==aLg==group':
                      'greetings'
                },
                {
                    'dottyLg==dotLg==group/dottyLg==dotLg==inLg==aLg==group':
                        'and'
                },
                {
                    'dottyLg==dotLg==group/dottyLg==dotLg==inLg==aLg==group':
                    'salutations'
                },
            ],
            #############################
            'formhub/uuid': 'c1aae157497d477aa3443b2ca9306e2e',
            'meta/instanceID': 'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            'regular': '1.3'
        }]
        decoded_results = [{
            '__version__': 'vPtjMxE37b4kgqoCBFEkeb',
            '_attachments': [],
            '_bamboo_dataset_id': '',
            '_geolocation': [None, None],
            '_id': 190,
            '_notes': [],
            '_status': 'submitted_via_web',
            '_submission_time': '2017-12-20T07:19:38',
            '_submitted_by': None,
            '_tags': [],
            '_userform_id': 'someuser_afgNxNby4VxHJ4STM2LmVz',
            '_uuid': 'f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            '_xform_id_string': 'afgNxNby4VxHJ4STM2LmVz',
            # Important portion follows #
            'dotty.dot.group': [
                {'dotty.dot.group/dotty.dot.in.a.group': 'greetings'},
                {'dotty.dot.group/dotty.dot.in.a.group': 'and'},
                {'dotty.dot.group/dotty.dot.in.a.group': 'salutations'},
            ],
            #############################
            'formhub/uuid': 'c1aae157497d477aa3443b2ca9306e2e',
            'meta/instanceID': 'uuid:f9753a6e-abd3-47e3-a218-9ad1adfa2688',
            'regular': '1.3'
        }]
        settings.MONGO_DB = FakeMongoDB(encoded_results)
        decoded = list(get_instances_from_mongo())
        expected_results = decoded_results
        self.assertEqual(decoded, expected_results)
