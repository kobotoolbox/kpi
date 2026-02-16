import glob
import io
import os
import uuid

from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import ConflictingSubmissionUUIDError
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.utils.counters import update_user_counters
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    add_uuid_prefix,
    get_uuid_from_xml,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


def open_all_files(path):
    file_paths = glob.glob(os.path.join(path, '*'))
    result = {}
    for file_path in file_paths:
        if file_path.endswith('.jpg'):
            # note the "rb" mode is to open a binary file
            result[file_path] = open(file_path, 'rb')
        else:
            result[file_path] = open(file_path)
    return result


def create_post_data(path):
    xml_files = glob.glob(os.path.join(path, '*.xml'))
    if len(xml_files) != 1:
        raise Exception('There should be a single XML file in this directory.')
    xml_file = open(xml_files[0])
    post_data = {'xml_submission_file': xml_file}

    for jpg in glob.glob(os.path.join(path, '*.jpg')):
        # note the "rb" mode is to open a binary file
        image_file = open(jpg, 'rb')
        post_data[jpg] = image_file

    return post_data


def get_absolute_path(subdirectory):
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)), subdirectory)


class TestInstanceCreation(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='bob')
        _ = UserProfile.objects.get_or_create(user=self.user)

        absolute_path = get_absolute_path('forms')
        open_forms = open_all_files(absolute_path)
        self.json = '{"default_language": "default", ' \
                    '"id_string": "Water_2011_03_17", "children": [], ' \
                    '"name": "Water_2011_03_17", ' \
                    '"title": "Water_2011_03_17", "type": "survey"}'
        for path, open_file in open_forms.items():
            XForm.objects.create(
                xml=open_file.read(), user=self.user, json=self.json,
                require_auth=False)
            open_file.close()

        self._create_water_translated_form()

    def _create_water_translated_form(self):
        f = open(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'Water_Translated_2011_03_10.xml',
            )
        )
        xml = f.read()
        f.close()
        self.xform = XForm.objects.create(
            xml=xml, user=self.user, json=self.json)

    def test_form_submission(self):
        # no more submission to non-existent form,
        # setUp ensures the Water_Translated_2011_03_10 xform is valid
        f = open(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'Water_Translated_2011_03_10_2011-03-10_14-38-28.xml',
            )
        )
        xml = f.read()
        f.close()
        Instance.objects.create(xml=xml, user=self.user, xform=self.xform)

    def test_data_submission(self):
        subdirectories = ['Water_2011_03_17_2011-03-17_16-29-59']
        for subdirectory in subdirectories:
            path = get_absolute_path(subdirectory)
            postdata = create_post_data(path)
            response = self.client.post('/bob/submission', postdata)
            self.assertEqual(response.status_code, 201)

        instance = Instance.objects.get(root_uuid='435f173c688e482486a48661700467gh')
        attachment = instance.attachments.first()
        assert attachment.media_file_basename == '1300375832136.jpg'
        assert attachment.xform_id == instance.xform_id
        assert attachment.user_id == instance.xform.user_id
        assert attachment.date_created is not None
        assert attachment.date_modified is not None

    def test_submission_for_missing_form(self):
        xml_file = open(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'Health_2011_03_13_invalid_id_string.xml',
            )
        )
        postdata = {'xml_submission_file': xml_file}
        response = self.client.post('/bob/submission', postdata)
        self.assertEqual(response.status_code, 404)

    def test_num_queries_when_updating_user_counters(self):
        """
        Only tests the number of queries. Other tests cover expected values.
        """
        self.test_data_submission()
        instance = Instance.objects.get(root_uuid='435f173c688e482486a48661700467gh')

        # Increase attachment storage bytes and the number of submissions
        with self.assertNumQueries(2):
            update_user_counters(
                instance,
                self.user.pk,
                attachment_storage_bytes=1,
                increase_num_of_submissions=True,
            )

        # Increase only attachment storage bytes
        with self.assertNumQueries(2):
            update_user_counters(instance, self.user.pk, attachment_storage_bytes=1)

        # Increase only the number of submissions
        with self.assertNumQueries(2):
            update_user_counters(
                instance,
                self.user.pk,
                increase_num_of_submissions=True,
            )

        # Increase counters with no profile
        UserProfile.objects.filter(user=self.user).delete()
        with self.assertNumQueries(8):
            # UserProfile creation calls a signal to add guardian permissions
            # FIXME in `main` branch. Guardian does not exist anymore
            update_user_counters(
                instance,
                self.user.pk,
                attachment_storage_bytes=1,
                increase_num_of_submissions=True,
            )
        assert UserProfile.objects.filter(user=self.user).exists()

    def test_edit_fails_with_duplicate_uuid_when_root_uuid_mismatches(self):
        """
        Test that ConflictingSubmissionUUIDError is raised when multiple instances
        share the same UUID and the root_uuid from the edit submission doesn't
        match any of them.
        """

        class FakeRequest:
            pass

        request = FakeRequest()
        request.user = self.user
        request.user.has_perm = lambda *args, **kwargs: True

        # Load XML from existing test file
        xml_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'Water_Translated_2011_03_10_2011-03-10_14-38-28.xml',
        )
        with open(xml_path) as f:
            xml_content = f.read()

        xml_file = io.BytesIO(xml_content.encode('utf-8'))
        first_uuid = get_uuid_from_xml(xml_content)

        # Create first instance with uuid=A, root_uuid=R1
        create_instance(
            self.user.username,
            xml_file,
            media_files=[],
            request=request,
            check_usage_limits=False,
        )

        # Create a second instance with the same uuid but different root_uuid
        # (simulating old data where uuid wasn't unique)
        Instance.objects.create(
            xml=xml_content,
            user=self.user,
            xform=self.xform,
            uuid=first_uuid,
            root_uuid=str(uuid.uuid4()),
        )

        # Now we have 2 instances with uuid=A (different root_uuids: R1 and R2)
        assert Instance.objects.filter(uuid=first_uuid).count() == 2

        # Try to edit with deprecatedID=A and a root_uuid that matches neither instance
        non_existent_root_uuid = str(uuid.uuid4())
        new_uuid = str(uuid.uuid4())
        xml_parsed = fromstring_preserve_root_xmlns(xml_content)

        # Add deprecatedID pointing to first_uuid
        edit_submission_xml(
            xml_parsed,
            'meta/deprecatedID',
            add_uuid_prefix(first_uuid),
        )
        # Use a root_uuid that doesn't exist in the database
        edit_submission_xml(
            xml_parsed,
            'meta/rootUuid',
            add_uuid_prefix(non_existent_root_uuid),
        )
        # New instanceID
        edit_submission_xml(
            xml_parsed,
            'meta/instanceID',
            add_uuid_prefix(new_uuid),
        )

        edited_xml = xml_tostring(xml_parsed)
        xml_file_edited = io.BytesIO(edited_xml.encode('utf-8'))

        # This should raise ConflictingSubmissionUUIDError because we can't
        # disambiguate which instance to edit
        with self.assertRaises(ConflictingSubmissionUUIDError) as context:
            create_instance(
                self.user.username,
                xml_file_edited,
                media_files=[],
                request=request,
                check_usage_limits=False,
            )

        assert 'Multiple submissions found with the same DeprecatedID' in str(
            context.exception
        )

    def test_edit_fails_when_duplicate_uuids_have_null_root_uuid(self):
        """
        Test that ConflictingSubmissionUUIDError is raised when multiple instances
        share the same UUID and the root_uuid from the edit submission doesn't
        match any of them (because they all have null root_uuid).

        This simulates legacy data where UUID uniqueness wasn't enforced and tests
        that we properly reject edits when disambiguation is impossible.
        """

        class FakeRequest:
            pass

        request = FakeRequest()
        request.user = self.user
        request.user.has_perm = lambda *args, **kwargs: True

        # Load XML from existing test file
        xml_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'Water_Translated_2011_03_10_2011-03-10_14-38-28.xml',
        )
        with open(xml_path) as f:
            xml_content = f.read()

        xml_file = io.BytesIO(xml_content.encode('utf-8'))
        first_uuid = get_uuid_from_xml(xml_content)

        # Create first instance with uuid=A
        first_instance = create_instance(
            self.user.username,
            xml_file,
            media_files=[],
            request=request,
            check_usage_limits=False,
        )

        # Simulate legacy data: remove root_uuid to create ambiguity
        Instance.objects.filter(pk=first_instance.pk).update(root_uuid=None)

        # Create a duplicate instance with the same UUID (simulates old bug/race condition)
        second_instance = Instance.objects.create(
            xml=xml_content,
            user=self.user,
            xform=self.xform,
            uuid=first_uuid,
        )

        # Also remove root_uuid from the duplicate
        Instance.objects.filter(pk=second_instance.pk).update(root_uuid=None)

        # Verify setup: 2 instances with the same UUID and null root_uuid
        assert (
            Instance.objects.filter(
                uuid=first_uuid, root_uuid__isnull=True
            ).count()
            == 2
        )

        # Prepare an edit submission with deprecatedID pointing to the duplicate UUID
        new_uuid = str(uuid.uuid4())
        xml_parsed = fromstring_preserve_root_xmlns(xml_content)

        # Set deprecatedID to the original UUID (trying to edit one of the duplicates)
        edit_submission_xml(
            xml_parsed,
            'meta/deprecatedID',
            add_uuid_prefix(first_uuid),
        )
        # Set a root_uuid that doesn't match any existing instance.This would normally
        # help disambiguate, but since all root_uuid are null, it cannot.
        edit_submission_xml(
            xml_parsed,
            'meta/rootUuid',
            add_uuid_prefix(new_uuid),
        )
        # Assign new instanceID for the edit
        edit_submission_xml(
            xml_parsed,
            'meta/instanceID',
            add_uuid_prefix(new_uuid),
        )

        edited_xml = xml_tostring(xml_parsed)
        xml_file_edited = io.BytesIO(edited_xml.encode('utf-8'))

        # Attempt to submit the edit - should fail because we can't determine
        # which of the duplicate instances is being edited
        with self.assertRaises(ConflictingSubmissionUUIDError) as context:
            create_instance(
                self.user.username,
                xml_file_edited,
                media_files=[],
                request=request,
                check_usage_limits=False,
            )

        assert 'Multiple submissions found with the same DeprecatedID' in str(
            context.exception
        )

    def test_edit_succeeds_with_duplicate_uuid_when_root_uuid_disambiguates(self):
        """
        Test that when multiple instances share the same UUID, we can successfully
        edit one by matching its root_uuid.
        """

        class FakeRequest:
            pass

        request = FakeRequest()
        request.user = self.user
        request.user.has_perm = lambda *args, **kwargs: True

        # Load XML from existing test file
        xml_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'Water_Translated_2011_03_10_2011-03-10_14-38-28.xml',
        )
        with open(xml_path) as f:
            xml_content = f.read()

        xml_file = io.BytesIO(xml_content.encode('utf-8'))
        first_uuid = get_uuid_from_xml(xml_content)

        # Create first instance with uuid=A, root_uuid=R1
        first_instance = create_instance(
            self.user.username,
            xml_file,
            media_files=[],
            request=request,
            check_usage_limits=False,
        )
        first_root_uuid = first_instance.root_uuid
        first_pk = first_instance.pk

        # Create a second instance with the same uuid but different root_uuid
        # (simulating old data where uuid wasn't unique)
        second_root_uuid = str(uuid.uuid4())
        Instance.objects.create(
            xml=xml_content,
            user=self.user,
            xform=self.xform,
            uuid=first_uuid,  # Same UUID!
            root_uuid=second_root_uuid,  # Different root_uuid
        )

        # Now we have 2 instances with uuid=A (different root_uuids: R1 and R2)
        assert Instance.objects.filter(uuid=first_uuid).count() == 2

        # Try to edit the FIRST instance by using deprecatedID=A and root_uuid=R1
        new_uuid = str(uuid.uuid4())
        xml_parsed = fromstring_preserve_root_xmlns(xml_content)

        # Add deprecatedID pointing to first_uuid
        edit_submission_xml(
            xml_parsed,
            'meta/deprecatedID',
            add_uuid_prefix(first_uuid),
        )
        # Use the root_uuid from the FIRST instance
        edit_submission_xml(
            xml_parsed,
            'meta/rootUuid',
            add_uuid_prefix(first_root_uuid),
        )
        # New instanceID
        edit_submission_xml(
            xml_parsed,
            'meta/instanceID',
            add_uuid_prefix(new_uuid),
        )

        edited_xml = xml_tostring(xml_parsed)
        xml_file_edited = io.BytesIO(edited_xml.encode('utf-8'))

        # This should successfully edit the first instance because root_uuid
        # matches and disambiguates which instance to update
        edited_instance = create_instance(
            self.user.username,
            xml_file_edited,
            media_files=[],
            request=request,
            check_usage_limits=False,
        )

        # Verify it updated the FIRST instance (same pk and root_uuid)
        assert edited_instance.pk == first_pk
        assert edited_instance.root_uuid == first_root_uuid
        assert edited_instance.uuid == new_uuid

        # Verify we still have only 2 instances
        assert Instance.objects.filter(xform=self.xform).count() == 2
