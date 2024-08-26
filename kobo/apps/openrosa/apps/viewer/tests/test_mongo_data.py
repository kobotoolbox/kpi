# coding: utf-8
import os

from django.conf import settings

from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import XForm

'''
Testing that data in parsed instance's mongo_dict is properly categorized.
'''


class TestMongoData(TestBase):
    def setUp(self):
        TestBase.setUp(self)
        self.instances = settings.MONGO_DB.instances
        self.instances.delete_many({})
        self.assertEqual(self.instances.count_documents({}), 0)
        xls_path = os.path.join(self.this_directory, 'fixtures',
                                'transportation', 'mongo',
                                'transportation_with_dirty_mongo_ids.xls')
        count = XForm.objects.count()
        self._publish_xls_file(xls_path)
        self.assertEqual(XForm.objects.count(), count + 1)
        self.xform = XForm.objects.all().reverse()[0]
        self._make_submission(os.path.join(
            self.this_directory, 'fixtures', 'transportation', 'mongo',
            'transport_2011-07-25_19-05-36' + '.xml'))
        self.pi = self.xform.instances.all()[0].parsed_instance

    def test_mongo_find_one(self):
        self.assertEqual(self.pi.to_dict_for_mongo(),
                          self.instances.find_one())

    def test_mongo_find(self):
        self.assertNotEqual([self.pi.to_dict()], list(self.instances.find()))
        self.assertEqual([self.pi.to_dict_for_mongo()],
                          list(self.instances.find()))

    def test_mongo_find_by_id(self):
        self.assertEqual(self.pi.to_dict_for_mongo(), self.instances.find_one(
                          {common_tags.ID: self.pi.instance.id}))

    def test_mongo_find_by_uuid(self):
        self.assertEqual(self.pi.to_dict_for_mongo(), self.instances.find_one(
                          {common_tags.UUID: self.pi.instance.uuid}))

    def test_mongo_find_by_key_value_pair(self):
        for key, value in self.pi.to_dict_for_mongo().items():
            self.assertEqual(self.pi.to_dict_for_mongo(),
                              self.instances.find_one({key: value}))
