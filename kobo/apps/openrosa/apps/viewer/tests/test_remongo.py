# coding: utf-8
import os

from django.conf import settings
from django.core.management import call_command
from django_digest.test import DigestAuth

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.apps.viewer.management.commands.remongo import Command
from kobo.apps.openrosa.libs.utils.common_tags import USERFORM_ID


class TestRemongo(TestBase):
    def test_remongo_in_batches(self):
        self._publish_transportation_form()
        # submit 4 instances
        self._make_submissions()
        self.assertEqual(ParsedInstance.objects.count(), 4)
        # clear mongo
        settings.MONGO_DB.instances.drop()
        c = Command()
        c.handle(batchsize=3)
        # mongo db should now have 5 records
        count = settings.MONGO_DB.instances.count_documents(filter={})
        self.assertEqual(count, 4)

    def test_remongo_with_username_id_string(self):
        self._publish_transportation_form()
        # submit 1 instances
        s = self.surveys[0]
        self._make_submission(os.path.join(self.this_directory, 'fixtures',
                              'transportation', 'instances', s, s + '.xml'))
        # publish and submit for a different user
        self._logout()
        self._create_user_and_login("harry", "harry")
        auth = DigestAuth("harry", "harry")
        self._publish_transportation_form()
        s = self.surveys[1]
        self._make_submission(os.path.join(self.this_directory, 'fixtures',
                              'transportation', 'instances', s, s + '.xml'),
                              username="harry", auth=auth)

        self.assertEqual(ParsedInstance.objects.count(), 2)
        # clear mongo
        settings.MONGO_DB.instances.drop()
        c = Command()
        c.handle(batchsize=3, username=self.user.username,
                 id_string=self.xform.id_string)
        # mongo db should now have 2 records
        count = settings.MONGO_DB.instances.count_documents(filter={})
        self.assertEqual(count, 1)

    def test_indexes_exist(self):
        """
        Make sure the required indexes are set, _userform_id as of now
        """
        call_command('remongo')
        # if index exists, ensure index returns None
        # list of indexes to check for
        index_list = [USERFORM_ID]
        # get index info
        index_info = settings.MONGO_DB.instances.index_information()
        # index_info looks like this - {
        #     '_id_': {'key': [('_id', 1)], 'v': 1},
        #     '_userform_id_1': {'key': [('_userform_id', 1)], 'v': 1}}
        # lets make a list of the indexes
        existing_indexes = [v['key'][0][0] for v in index_info.values()
                            if v['key'][0][1] == 1]
        all_indexes_found = True
        for index_item in index_list:
            if index_item not in existing_indexes:
                all_indexes_found = False
                break
        self.assertTrue(all_indexes_found)

    def test_sync_mongo_with_all_option_deletes_existing_records(self):
        self._publish_transportation_form()
        userform_id = "%s_%s" % (self.user.username, self.xform.id_string)
        initial_mongo_count = settings.MONGO_DB.instances.count_documents(
            {USERFORM_ID: userform_id})
        for i in range(len(self.surveys)):
            self._submit_transport_instance(i)
        mongo_count = settings.MONGO_DB.instances.count_documents(
            {USERFORM_ID: userform_id})
        # check our mongo count
        self.assertEqual(mongo_count, initial_mongo_count + len(self.surveys))
        # add dummy instance
        settings.MONGO_DB.instances.insert_one(
            {"_id": 12345, "_userform_id": userform_id})
        # make sure the dummy is returned as part of the forms mongo instances
        mongo_count = settings.MONGO_DB.instances.count_documents(
            {USERFORM_ID: userform_id})
        self.assertEqual(mongo_count,
                         initial_mongo_count + len(self.surveys) + 1)
        # call sync_mongo WITHOUT the all option
        call_command("sync_mongo", remongo=True)
        mongo_count = settings.MONGO_DB.instances.count_documents(
            {USERFORM_ID: userform_id})
        self.assertEqual(mongo_count,
                         initial_mongo_count + len(self.surveys) + 1)
        # call sync_mongo WITH the all option
        call_command("sync_mongo", remongo=True, update_all=True)
        # check that we are back to just the submitted set
        mongo_count = settings.MONGO_DB.instances.count_documents(
            {USERFORM_ID: userform_id})
        self.assertEqual(mongo_count,
                         initial_mongo_count + len(self.surveys))
