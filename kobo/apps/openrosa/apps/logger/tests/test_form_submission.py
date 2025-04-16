# coding: utf-8
import os
import re
from unittest.mock import patch

from django.http import Http404
from django_digest.test import DigestAuth
from django_digest.test import Client as DigestClient
from kobo.apps.openrosa.libs.utils.guardian import assign_perm

from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import Instance, Attachment
from kobo.apps.openrosa.apps.logger.models.instance import InstanceHistory
from kobo.apps.openrosa.apps.logger.xform_instance_parser import clean_and_parse_xml
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils.common_tags import GEOLOCATION


class TestFormSubmission(TestBase):
    """
    Testing POSTs to "/submission"
    """

    def setUp(self):
        TestBase.setUp(self)
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/tutorial/tutorial.xls"
        )
        self._publish_xls_file_and_set_xform(xls_file_path)

    def test_form_post(self):
        """
        xml_submission_file is the field name for the posted xml file.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53_w_uuid.xml'
        )

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)

    @patch('django.utils.datastructures.MultiValueDict.pop')
    def test_fail_with_ioerror_read(self, mock_pop):
        mock_pop.side_effect = IOError(
            'request data read error')

        self.assertEqual(0, self.xform.instances.count())

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53.xml"
        )
        with self.assertRaises(OSError):
            self._make_submission(xml_submission_file_path)
        # FIXME, according to old test, it should return a 400.
        #   DRF may handle IOError differently than the legacy view but it seems
        #   that a 500 is more accurate IMHO.
        # self.assertEqual(self.response.status_code, 400)
        self.assertEqual(self.response, None)

        self.assertEqual(0, self.xform.instances.count())

    @patch('django.utils.datastructures.MultiValueDict.pop')
    def test_fail_with_ioerror_wsgi(self, mock_pop):
        mock_pop.side_effect = IOError(
            'error during read(65536) on wsgi.input')

        self.assertEqual(0, self.xform.instances.count())

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53.xml"
        )
        with self.assertRaises(OSError):
            self._make_submission(xml_submission_file_path)
        # FIXME, according to old test, it should return a 400.
        #   DRF may handle IOError differently than the legacy view but it seems
        #   that a 500 is more accurate IMHO.
        # self.assertEqual(self.response.status_code, 400)
        self.assertEqual(self.response, None)

        self.assertEqual(0, self.xform.instances.count())

    def test_submission_to_require_auth_anon(self):
        """
        test submission anonymous cannot submit to a private form
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53.xml"
        )

        # Anonymous should authenticate when submit data to `/<username>/submission`
        self._make_submission(
            xml_submission_file_path, auth=False, assert_success=False
        )
        self.assertEqual(self.response.status_code, 401)

        # …or `/submission`
        self._make_submission(
            xml_submission_file_path,
            username='',
            auth=False,
            assert_success=False,
        )
        self.assertEqual(self.response.status_code, 401)

    def test_submission_to_not_required_auth_as_anonymous_user(self):
        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53_w_uuid.xml'
        )

        # Anonymous should be able to submit data
        self._make_submission(
            xml_submission_file_path, auth=False, assert_success=False
        )
        self.assertEqual(self.response.status_code, 201)

    def test_submission_to_require_auth_without_perm(self):
        """
        test submission to a private form by non-owner without perm is
        forbidden.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53.xml'
        )

        # create a new user
        username = 'alice'
        self._create_user(username, username)
        self._make_submission(
            xml_submission_file_path,
            auth=DigestAuth('alice', 'alice'),
            assert_success=False,
        )
        self.assertEqual(self.response.status_code, 403)

    def test_submission_to_require_auth_with_perm(self):
        # create a new user
        username = 'alice'
        alice = self._create_user(username, username)

        # assign report perms to user
        assign_perm('report_xform', alice, self.xform)
        auth = DigestAuth(username, username)

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53_w_uuid.xml'
        )
        self._make_submission(xml_submission_file_path, auth=auth)
        self.assertEqual(self.response.status_code, 201)

    def test_form_post_to_missing_form(self):
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/tutorial/instances/"
            "tutorial_invalid_id_string_2012-06-27_11-27-53.xml"
        )
        self._make_submission(
            path=xml_submission_file_path, assert_success=False
        )
        self.assertEqual(self.response.status_code, 404)

    def test_duplicate_submissions(self):
        """
        Test submissions for forms with start and end
        """
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/test_forms/survey_names/survey_names.xls"
        )
        self._publish_xls_file(xls_file_path)
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../fixtures/test_forms/survey_names/instances/"
            "survey_names_2012-08-17_11-24-53.xml"
        )

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 202)

    def test_unicode_submission(self):
        """Test xml submissions that contain unicode characters
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_unicode_submission.xml"
        )

        # create a new user
        alice = self._create_user('alice', 'alice')

        # assign report perms to user
        assign_perm('report_xform', alice, self.xform)
        client = DigestClient()
        client.set_authorization('alice', 'alice', 'Digest')

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)

    def test_duplicate_submission_with_same_instanceID(self):
        """Test duplicate xml submissions
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 202)

    def test_duplicate_submission_with_different_content(self):
        """
        Test xml submissions with same instanceID but different content
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        duplicate_xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_same_instanceID.xml"
        )

        pre_count = Instance.objects.count()
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), pre_count + 1)
        inst = Instance.objects.order_by('pk').last()
        self._make_submission(duplicate_xml_submission_file_path, assert_success=False)
        self.assertEqual(self.response.status_code, 409)
        self.assertEqual(Instance.objects.count(), pre_count + 1)
        # this is exactly the same instance
        another_inst = Instance.objects.order_by('pk').last()
        self.assertEqual(inst.xml, another_inst.xml)

    def test_duplicate_submission_with_same_content_but_with_attachment(self):
        """
        Test that submitting the same XML content twice,
        first without and then with an attachment,
        results in a single instance with the attachment added.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            'tutorial_2012-06-27_11-27-53_w_attachment.xml'
        )
        media_file_path = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            '1335783522563.jpg'
        )
        initial_instance_count = Instance.objects.count()

        # Test submission with XML file
        self._make_submission(xml_submission_file_path)
        initial_instance = Instance.objects.last()
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)

        # Test duplicate submission with attachment
        with open(media_file_path, 'rb') as media_file:
            self._make_submission(xml_submission_file_path, media_file=media_file)
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        self.assertEqual(
            Attachment.objects.filter(instance=initial_instance).count(), 1
        )

    def test_duplicate_submission_with_same_content_but_with_different_attachment(self):
        """
        Test duplicate submission handling:
        - New submission without attachment should succeed.
        - Same submission with an attachment should succeed,
        adding the attachment.
        - Resubmission with the same attachment should be rejected
         with a 202 status code.
        - Resubmission with a different attachment (same file name) should be
         rejected with a 202 status code.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            'tutorial_2012-06-27_11-27-53_w_attachment.xml',
        )
        media_file_path1 = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            '1335783522563.jpg',
        )
        media_file_path2 = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment/'
            'attachment_with_different_content',
            '1335783522563.jpg',
        )
        initial_instance_count = Instance.objects.count()

        # Test submission with XML file
        self._make_submission(xml_submission_file_path)
        initial_instance = Instance.objects.last()
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)

        # Test duplicate submission with attachment
        with open(media_file_path1, 'rb') as media_file:
            self._make_submission(xml_submission_file_path, media_file=media_file)
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        self.assertEqual(
            Attachment.objects.filter(instance=initial_instance).count(), 1
        )

        # Test duplicate submission with the same attachment
        with open(media_file_path1, 'rb') as media_file:
            self._make_submission(xml_submission_file_path, media_file=media_file)
        self.assertEqual(self.response.status_code, 202)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        self.assertEqual(
            Attachment.objects.filter(instance=initial_instance).count(), 1
        )

        # Test duplicate submission with the same attachment name but with
        # different attachment content
        with open(media_file_path2, 'rb') as media_file2:
            self._make_submission(xml_submission_file_path, media_file=media_file2)
        self.assertEqual(self.response.status_code, 202)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        self.assertEqual(
            Attachment.objects.filter(instance=initial_instance).count(), 1
        )

    def test_edit_submission_with_same_attachment_name_but_different_content(self):
        """
        Test editing a submission with an attachment with the same name
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            'tutorial_2012-06-27_11-27-53_w_attachment.xml',
        )
        xml_edit_submission_file_path = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            'tutorial_2012-06-27_11-27-53_w_attachment_edit.xml',
        )
        media_file_path1 = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment',
            '1335783522563.jpg',
        )
        media_file_path2 = os.path.join(
            os.path.dirname(__file__),
            '../fixtures/tutorial/instances/tutorial_with_attachment/'
            'attachment_with_different_content',
            '1335783522563.jpg',
        )
        initial_instance_count = Instance.objects.count()

        # Test submission with attachment
        with open(media_file_path1, 'rb') as media_file:
            self._make_submission(
                xml_submission_file_path, media_file=media_file
            )
        initial_instance = Instance.objects.order_by('-pk')[0]

        attachments = Attachment.objects.filter(instance=initial_instance)
        self.assertTrue(attachments.count() == 1)
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        attachment = attachments[0]
        attachment_basename = attachment.media_file_basename
        attachment_hash = attachment.file_hash

        # test edit submission with the same attachment name but different attachment
        # content
        with open(media_file_path2, 'rb') as media_file:
            self._make_submission(
                xml_edit_submission_file_path, media_file=media_file
            )

        edited_instance = Instance.objects.order_by('-pk')[0]
        edited_attachments = Attachment.objects.filter(instance=edited_instance)
        self.assertTrue(attachments.count() == 1)
        self.assertEqual(Instance.objects.count(), initial_instance_count + 1)
        self.assertEqual(self.response.status_code, 201)

        edited_attachment = edited_attachments[0]
        edited_attachment_basename = edited_attachment.media_file_basename
        edited_attachment_hash = edited_attachment.file_hash
        self.assertEqual(attachment_basename, edited_attachment_basename)
        self.assertNotEqual(attachment_hash, edited_attachment_hash)

    def test_owner_can_edit_submissions(self):
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        num_instances_history = InstanceHistory.objects.count()
        num_instances = Instance.objects.count()
        query_args = {
            'username': self.user.username,
            'id_string': self.xform.id_string,
            'query': '{}',
            'fields': '[]',
            'sort': '[]',
            'count': True
        }

        cursor = ParsedInstance.query_mongo(**query_args)
        num_mongo_instances = cursor[0]['count']
        # make first submission
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        self.assertEqual(Instance.objects.count(), num_instances + 1)
        # no new record in instances history
        self.assertEqual(
            InstanceHistory.objects.count(), num_instances_history)
        # check count of mongo instances after first submission
        cursor = ParsedInstance.query_mongo(**query_args)
        self.assertEqual(cursor[0]['count'], num_mongo_instances + 1)
        # edited submission
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        # we must have the same number of instances
        self.assertEqual(Instance.objects.count(), num_instances + 1)
        # should be a new record in instances history
        self.assertEqual(
            InstanceHistory.objects.count(), num_instances_history + 1)
        cursor = ParsedInstance.query_mongo(**query_args)
        self.assertEqual(cursor[0]['count'], num_mongo_instances + 1)
        # make sure we edited the mongo db record and NOT added a new row
        query_args['count'] = False
        cursor = ParsedInstance.query_mongo(**query_args)
        record = cursor[0]
        with open(xml_submission_file_path, "r") as f:
            xml_str = f.read()
        xml_str = clean_and_parse_xml(xml_str).toxml()
        edited_name = re.match(r"^.+?<name>(.+?)</name>", xml_str).groups()[0]
        self.assertEqual(record['name'], edited_name)

    def test_submission_w_mismatched_uuid(self):
        """
        test allowing submissions where xml's form uuid doesnt match
        any form's uuid for a user, as long as id_string can be matched
        """
        # submit instance with uuid that would not match the forms
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_xform_uuid.xml"
        )

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)

    def _test_fail_submission_if_no_username(self):
        """
        Test that a submission fails if no username is provided
        and the UUIDs don't match.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_xform_uuid.xml"
        )
        with self.assertRaises(Http404):
            self._make_submission(path=xml_submission_file_path, username='')

    def test_fail_submission_if_bad_id_string(self):
        """Test that a submission fails if the uuids don't match.
        """
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_bad_id_string.xml"
        )
        self._make_submission(
            path=xml_submission_file_path, assert_success=False
        )
        self.assertEqual(self.response.status_code, 404)

    def test_edit_updated_geopoint_cache(self):
        query_args = {
            'username': self.user.username,
            'id_string': self.xform.id_string,
            'query': '{}',
            'fields': '[]',
            'sort': '[]',
            'count': True
        }
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )

        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        # query mongo for the _geopoint field
        query_args['count'] = False
        records = list(ParsedInstance.query_mongo(**query_args))
        self.assertEqual(len(records), 1)
        # submit the edited instance
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        records = list(ParsedInstance.query_mongo(**query_args))
        self.assertEqual(len(records), 1)
        cached_geopoint = records[0][GEOLOCATION]
        # the cached geopoint should equal the gps field
        gps = records[0]['gps'].split(" ")
        self.assertEqual(float(gps[0]), float(cached_geopoint[0]))
        self.assertEqual(float(gps[1]), float(cached_geopoint[1]))

    def test_submission_when_requires_auth(self):
        # create a new user
        alice = self._create_user('alice', 'alice')

        # assign report perms to user
        assign_perm('report_xform', alice, self.xform)

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53_w_uuid.xml'
        )
        auth = DigestAuth('alice', 'alice')
        self._make_submission(
            xml_submission_file_path, auth=auth)
        self.assertEqual(self.response.status_code, 201)

    def test_submission_linked_to_reporter(self):
        # create a new user
        alice = self._create_user('alice', 'alice')
        UserProfile.objects.create(user=alice)

        # assign report perms to user
        assign_perm('report_xform', alice, self.xform)

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/tutorial/instances/tutorial_2012-06-27_11-27-53_w_uuid.xml'
        )
        auth = DigestAuth('alice', 'alice')
        self._make_submission(
            xml_submission_file_path, auth=auth)
        self.assertEqual(self.response.status_code, 201)
        instance = Instance.objects.all().reverse()[0]
        self.assertEqual(instance.user, alice)

    def test_anonymous_cannot_edit_submissions(self):
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        # make first submission
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        created_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(
            created_instance.uuid,
            '729f173c688e482486a48661700455ff',
        )
        # attempt an edit
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        # …without "Require authentication to see form and submit data"
        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])

        self._make_submission(
            xml_submission_file_path, auth=False, assert_success=False
        )
        self.assertEqual(self.response.status_code, 401)
        self.assertEqual(
            Instance.objects.order_by('pk').last().xml_hash,
            created_instance.xml_hash,
        )
        # …now with "Require authentication to…"
        self.xform.require_auth = True
        self.xform.save(update_fields=['require_auth'])
        self._make_submission(
            xml_submission_file_path, auth=False, assert_success=False
        )
        self.assertEqual(self.response.status_code, 401)
        self.assertEqual(
            Instance.objects.order_by('pk').last().xml_hash,
            created_instance.xml_hash,
        )

    def test_authorized_user_can_edit_submissions_without_require_auth(self):
        """
        This is nice but unfortunately does not reflect how Enketo acts when
        editing submissions. Enketo *always* sends an unauthenticated HEAD
        request, even if the editing user has already provided credentials. If
        the HEAD request does not receive a 401 response, Enketo will submit
        anonymously.
        There's no way to determine whether Enketo's HEAD was sent with the
        intent of editing or making a new submission, making it effectively
        impossible to support authenticated editing and anonymous (new)
        submissions at the same time.
        """

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        # make first submission
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        created_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(
            created_instance.uuid,
            '729f173c688e482486a48661700455ff',
        )
        # create a new user with permission to edit submissions
        alice = self._create_user('alice', 'alice')
        UserProfile.objects.create(user=alice)
        assign_perm('report_xform', alice, self.xform)
        assign_perm('logger.change_xform', alice, self.xform)
        auth = DigestAuth('alice', 'alice')
        # attempt an edit
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        self._make_submission(xml_submission_file_path, auth=auth)
        self.assertEqual(self.response.status_code, 201)
        # verify edit
        edited_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(edited_instance.pk, created_instance.pk)
        self.assertEqual(
            edited_instance.uuid,
            '2d8c59eb-94e9-485d-a679-b28ffe2e9b98',
        )

    def test_authorized_user_can_edit_submissions_with_require_auth(self):

        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        # make first submission
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        created_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(
            created_instance.uuid,
            '729f173c688e482486a48661700455ff',
        )
        # create a new user with permission to edit submissions
        alice = self._create_user('alice', 'alice')
        UserProfile.objects.create(user=alice)
        assign_perm('report_xform', alice, self.xform)
        assign_perm('logger.change_xform', alice, self.xform)
        auth = DigestAuth('alice', 'alice')
        # attempt an edit
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        self._make_submission(xml_submission_file_path, auth=auth)
        self.assertEqual(self.response.status_code, 201)
        # verify edit
        edited_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(edited_instance.pk, created_instance.pk)
        self.assertEqual(
            edited_instance.uuid,
            '2d8c59eb-94e9-485d-a679-b28ffe2e9b98',
        )

    def test_unauthorized_cannot_edit_submissions(self):
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid.xml"
        )
        # make first submission
        self._make_submission(xml_submission_file_path)
        self.assertEqual(self.response.status_code, 201)
        created_instance = Instance.objects.order_by('pk').last()
        self.assertEqual(
            created_instance.uuid,
            '729f173c688e482486a48661700455ff',
        )
        # create a new user with permission to make new submissions but without
        # permission to edit submissions
        alice = self._create_user('alice', 'alice')
        UserProfile.objects.create(user=alice)
        assign_perm('report_xform', alice, self.xform)
        auth = DigestAuth('alice', 'alice')
        # attempt an edit
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "fixtures", "tutorial", "instances",
            "tutorial_2012-06-27_11-27-53_w_uuid_edited.xml"
        )
        # …without "Require authentication to see form and submit data"
        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])
        self._make_submission(
            xml_submission_file_path, auth=auth, assert_success=False
        )
        self.assertEqual(self.response.status_code, 403)
        self.assertEqual(
            Instance.objects.order_by('pk').last().xml_hash,
            created_instance.xml_hash,
        )
        # …now with "Require authentication to…"
        self.xform.require_auth = True
        self.xform.save(update_fields=['require_auth'])
        self._make_submission(
            xml_submission_file_path, auth=auth, assert_success=False
        )
        self.assertEqual(self.response.status_code, 403)
        self.assertEqual(
            Instance.objects.order_by('pk').last().xml_hash,
            created_instance.xml_hash,
        )
