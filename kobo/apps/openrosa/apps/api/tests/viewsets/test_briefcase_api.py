# coding: utf-8
import os

from django.urls import reverse
from django.test import override_settings
from django_digest.test import DigestAuth
from rest_framework.test import APIRequestFactory

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import TestAbstractViewSet
from kobo.apps.openrosa.apps.api.viewsets.briefcase_api import BriefcaseApi
from kobo.apps.openrosa.apps.api.viewsets.xform_submission_api import XFormSubmissionApi
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.utils.storage import rmdir


NUM_INSTANCES = 4


def ordered_instances(xform):
    return Instance.objects.filter(xform=xform).order_by('id')


class TestBriefcaseAPI(TestAbstractViewSet):

    def setUp(self):
        super(TestAbstractViewSet, self).setUp()
        self.factory = APIRequestFactory()
        self._login_user_and_profile()
        self.login_username = 'bob'
        self.login_password = 'bobbob'
        self.maxDiff = None
        self.form_def_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'transportation.xml')
        self._submission_list_url = reverse('view-submission-list')
        self._submission_url = reverse('submissions')
        self._download_submission_url = reverse('view-download-submission')
        self._form_upload_url = reverse('form-upload')

    def test_view_submission_list(self):
        view = BriefcaseApi.as_view({'get': 'list'})
        self._publish_xml_form()
        self._make_submissions()
        request = self.factory.get(
            self._submission_list_url,
            data={'formId': self.xform.id_string})
        response = view(request)
        self.assertEqual(response.status_code, 401)
        auth = DigestAuth(self.login_username, self.login_password)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertEqual(response.status_code, 200)
        submission_list_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'view', 'submissionList.xml')
        instances = ordered_instances(self.xform)

        self.assertEqual(instances.count(), NUM_INSTANCES)

        last_index = instances[instances.count() - 1].pk
        with open(submission_list_path, 'rb') as f:
            expected_submission_list = f.read().decode()
            expected_submission_list = \
                expected_submission_list.replace(
                    '{{resumptionCursor}}', str(last_index))
            self.assertContains(response, expected_submission_list)

    def test_cannot_view_submission_list_with_username(self):
        view = BriefcaseApi.as_view({'get': 'list'})
        self._publish_xml_form()
        self._make_submissions()

        request = self.factory.get(
            self._submission_list_url, data={'formId': self.xform.id_string}
        )
        response = view(request, username=self.user.username)
        self.assertEqual(response.status_code, 401)
        auth = DigestAuth(self.login_username, self.login_password)
        request.META.update(auth(request.META, response))
        response = view(request, username=self.user.username)
        self.assertEqual(response.status_code, 403)

    def test_view_submission_list_w_deleted_submission(self):
        view = BriefcaseApi.as_view({'get': 'list'})
        self._publish_xml_form()
        self._make_submissions()
        uuid = 'f3d8dc65-91a6-4d0f-9e97-802128083390'
        Instance.objects.filter(uuid=uuid).order_by('id').delete()
        request = self.factory.get(
            self._submission_list_url,
            data={'formId': self.xform.id_string})
        response = view(request)
        self.assertEqual(response.status_code, 401)
        auth = DigestAuth(self.login_username, self.login_password)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertEqual(response.status_code, 200)
        submission_list_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'view', 'submissionList-4.xml')
        instances = ordered_instances(self.xform)

        self.assertEqual(instances.count(), NUM_INSTANCES - 1)

        last_index = instances[instances.count() - 1].pk
        with open(submission_list_path, 'r') as f:
            expected_submission_list = f.read()
            expected_submission_list = \
                expected_submission_list.replace(
                    '{{resumptionCursor}}', '%s' % last_index)
            self.assertContains(response, expected_submission_list)

        view = BriefcaseApi.as_view({'get': 'retrieve'})
        form_id = (
            '%(formId)s[@version=null and @uiVersion=null]/'
            '%(formId)s[@key=uuid:%(instanceId)s]'
            % {'formId': self.xform.id_string, 'instanceId': uuid}
        )
        params = {'formId': form_id}
        request = self.factory.get(self._download_submission_url, data=params)
        response = view(request)
        self.assertEqual(response.status_code, 401)
        auth = DigestAuth(self.login_username, self.login_password)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertTrue(response.status_code, 404)

    def test_view_submission_list_other_user(self):
        view = BriefcaseApi.as_view({'get': 'list'})
        self._publish_xml_form()
        self._make_submissions()
        # alice cannot view bob's submissionList
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        self._create_user_profile(alice_data)
        auth = DigestAuth('alice', 'alicealice')
        request = self.factory.get(
            self._submission_list_url,
            data={'formId': self.xform.id_string})
        response = view(request)
        self.assertEqual(response.status_code, 401)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertEqual(response.status_code, 404)

    def test_view_submission_list_num_entries(self):
        def get_last_index(xform, last_index=None):
            instances = ordered_instances(xform)
            if not last_index and instances.count():
                return instances[instances.count() - 1].pk
            elif last_index:
                instances = instances.filter(pk__gt=last_index)
                if instances.count():
                    return instances[instances.count() - 1].pk
                else:
                    return get_last_index(xform)
            return 0

        view = BriefcaseApi.as_view({'get': 'list'})
        self._publish_xml_form()
        self._make_submissions()
        params = {
            'formId': self.xform.id_string,
            'numEntries': 2
        }
        instances = ordered_instances(self.xform)

        self.assertEqual(instances.count(), NUM_INSTANCES)

        last_index = instances[:2][1].pk
        last_expected_submission_list = ""
        for index in range(1, 5):
            auth = DigestAuth(self.login_username, self.login_password)
            request = self.factory.get(
                self._submission_list_url,
                data=params)
            response = view(request)
            self.assertEqual(response.status_code, 401)
            request.META.update(auth(request.META, response))
            response = view(request)
            self.assertEqual(response.status_code, 200)
            if index > 2:
                last_index = get_last_index(self.xform, last_index)
            filename = 'submissionList-%s.xml' % index
            if index == 4:
                self.assertContains(response, last_expected_submission_list)
                continue
            # set cursor for second request
            params['cursor'] = last_index
            submission_list_path = os.path.join(
                self.main_directory, 'fixtures', 'transportation',
                'view', filename)
            with open(submission_list_path, 'r') as f:
                expected_submission_list = f.read()
                last_expected_submission_list = expected_submission_list = \
                    expected_submission_list.replace(
                        '{{resumptionCursor}}', '%s' % last_index)
                self.assertContains(response, expected_submission_list)
            last_index += 2

    def test_view_download_submission(self):
        view = BriefcaseApi.as_view({'get': 'retrieve'})
        self._publish_xml_form()
        self.maxDiff = None
        self._submit_transport_instance_w_attachment()
        instance_id = '5b2cc313-fc09-437e-8149-fcd32f695d41'
        instance = Instance.objects.get(uuid=instance_id)
        form_id = '%(formId)s[@version=null and @uiVersion=null]/' \
                  '%(formId)s[@key=uuid:%(instanceId)s]' % {
                     'formId': self.xform.id_string,
                     'instanceId': instance_id}
        params = {'formId': form_id}
        auth = DigestAuth(self.login_username, self.login_password)
        request = self.factory.get(
            self._download_submission_url, data=params)
        response = view(request)
        self.assertEqual(response.status_code, 401)
        request.META.update(auth(request.META, response))
        response = view(request)
        download_submission_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'view', 'downloadSubmission.xml')
        with open(download_submission_path, mode='r') as f:
            text = f.read()
            text = text.replace('{{submissionDate}}',
                                instance.date_created.isoformat())
            text = text.replace('{{xform_uuid}}',
                                self.xform.uuid)
            self.assertContains(response, instance_id, status_code=200)
            self.assertMultiLineEqual(response.content.decode('utf-8'), text)

    def test_view_download_submission_no_xmlns(self):
        view = BriefcaseApi.as_view({'get': 'retrieve'})
        self._publish_xml_form()
        self.maxDiff = None
        self._submit_transport_instance_w_attachment(with_namespace=True)
        instance_id = '5b2cc313-fc09-437e-8149-fcd32f695d41'
        instance = Instance.objects.get(uuid=instance_id)
        form_id = '%(formId)s[@version=null and @uiVersion=null]/' \
                  '%(formId)s[@key=uuid:%(instanceId)s]' % {
                     'formId': self.xform.id_string,
                     'instanceId': instance_id}
        params = {'formId': form_id}
        auth = DigestAuth(self.login_username, self.login_password)
        request = self.factory.get(
            self._download_submission_url, data=params)
        response = view(request)
        self.assertEqual(response.status_code, 401)
        request.META.update(auth(request.META, response))
        response = view(request)
        download_submission_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'view', 'downloadSubmission.xml')
        response.render()
        self.assertContains(response, instance_id, status_code=200)
        self.assertNotIn(
            'transportation id="transportation_2011_07_25" '
            'xlmns="http://opendatakit.org/submission" '
            'instanceID="uuid:5b2cc313-fc09-437e-8149-fcd32f695d41"'
            f' submissionDate="{instance.date_created.isoformat()}" ',
            response.content.decode()
        )

        with override_settings(SUPPORT_BRIEFCASE_SUBMISSION_DATE=False):
            request = self.factory.get(
                self._download_submission_url, data=params)
            response = view(request)
            request.META.update(auth(request.META, response))
            response = view(request)
            response.render()
            self.assertNotIn(
                'transportation id="transportation_2011_07_25" '
                'xmlns="http://opendatakit.org/submission" '
                'instanceID="uuid:5b2cc313-fc09-437e-8149-fcd32f695d41" '
                f'submissionDate="{instance.date_created.isoformat()}" ',
                response.content.decode()
            )

    def test_view_download_submission_other_user(self):
        view = BriefcaseApi.as_view({'get': 'retrieve'})
        self._publish_xml_form()
        self.maxDiff = None
        self._submit_transport_instance_w_attachment()
        instanceId = '5b2cc313-fc09-437e-8149-fcd32f695d41'
        formId = '%(formId)s[@version=null and @uiVersion=null]/' \
                 '%(formId)s[@key=uuid:%(instanceId)s]' % {
                     'formId': self.xform.id_string,
                     'instanceId': instanceId}
        params = {'formId': formId}
        # alice cannot view bob's downloadSubmission
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        self._create_user_profile(alice_data)
        auth = DigestAuth('alice', 'alicealice')
        url = self._download_submission_url  # aliasing long name
        request = self.factory.get(url, data=params)
        response = view(request)
        self.assertEqual(response.status_code, 401)

        # Rewind the file to avoid the xml parser to get an empty string
        # and throw and parsing error
        request = request = self.factory.get(url, data=params)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertEqual(response.status_code, 404)

    def test_publish_xml_form_other_user(self):
        view = BriefcaseApi.as_view({'post': 'create'})
        # alice cannot publish form to bob's account
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        self._create_user_profile(alice_data)
        count = XForm.objects.count()

        with open(self.form_def_path, 'rb') as f:
            params = {'form_def_file': f, 'dataFile': ''}
            auth = DigestAuth('alice', 'alicealice')
            request = self.factory.post(self._form_upload_url, data=params)
            response = view(request, username=self.user.username)
            self.assertEqual(response.status_code, 401)
            request.META.update(auth(request.META, response))
            response = view(request, username=self.user.username)
            self.assertNotEqual(XForm.objects.count(), count + 1)
            self.assertEqual(response.status_code, 403)

    def test_publish_xml_form_where_filename_is_not_id_string(self):
        view = BriefcaseApi.as_view({'post': 'create'})
        form_def_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'Transportation Form.xml')
        count = XForm.objects.count()
        with open(form_def_path, 'rb') as f:
            params = {'form_def_file': f, 'dataFile': ''}
            auth = DigestAuth(self.login_username, self.login_password)
            request = self.factory.post(self._form_upload_url, data=params)
            response = view(request)
            self.assertEqual(response.status_code, 401)

            # Rewind the file to avoid the xml parser to get an empty string
            # and throw and parsing error
            f.seek(0)
            # Create a new requests to avoid request.FILES to be empty
            request = self.factory.post(self._form_upload_url, data=params)
            request.META.update(auth(request.META, response))
            response = view(request)
            self.assertEqual(XForm.objects.count(), count + 1)
            self.assertContains(
                response, "successfully published.", status_code=201)

    def _publish_xml_form(self, auth=None):
        view = BriefcaseApi.as_view({'post': 'create'})
        count = XForm.objects.count()

        with open(self.form_def_path, 'rb') as f:
            params = {'form_def_file': f, 'dataFile': ''}
            auth = auth or DigestAuth(self.login_username, self.login_password)
            request = self.factory.post(self._form_upload_url, data=params)
            response = view(request)
            self.assertEqual(response.status_code, 401)

            # Rewind the file to avoid the xml parser to get an empty string
            # and throw and parsing error
            f.seek(0)
            # Create a new requests to avoid request.FILES to be empty
            request = self.factory.post(self._form_upload_url, data=params)
            request.META.update(auth(request.META, response))
            response = view(request)
            self.assertEqual(XForm.objects.count(), count + 1)
            self.assertContains(
                response, "successfully published.", status_code=201)
        self.xform = XForm.objects.order_by('pk').reverse()[0]

    def test_form_upload(self):
        view = BriefcaseApi.as_view({'post': 'create'})
        self._publish_xml_form()

        with open(self.form_def_path, 'rb') as f:
            params = {'form_def_file': f, 'dataFile': ''}
            auth = DigestAuth(self.login_username, self.login_password)
            request = self.factory.post(self._form_upload_url, data=params)
            response = view(request)
            self.assertEqual(response.status_code, 401)

            # Rewind the file to avoid the xml parser to get an empty string
            # and throw and parsing error
            f.seek(0)
            # Create a new requests to avoid request.FILES to be empty
            request = self.factory.post(self._form_upload_url, data=params)
            request.META.update(auth(request.META, response))
            response = view(request)
            self.assertEqual(response.status_code, 400)
            # SQLite returns `UNIQUE constraint failed` whereas PostgreSQL
            # returns 'duplicate key ... violates unique constraint'
            self.assertIn(
                'unique constraint',
                response.data['message'].lower(),
            )

    def test_upload_head_request(self):
        view = BriefcaseApi.as_view({'head': 'create'})

        auth = DigestAuth(self.login_username, self.login_password)
        request = self.factory.head(self._form_upload_url)
        response = view(request)
        self.assertEqual(response.status_code, 401)
        request.META.update(auth(request.META, response))
        response = view(request)
        self.assertEqual(response.status_code, 204)
        self.assertTrue(response.has_header('X-OpenRosa-Version'))
        self.assertTrue(
            response.has_header('X-OpenRosa-Accept-Content-Length'))
        self.assertTrue(response.has_header('Date'))

    def test_submission_with_instance_id_on_root_node(self):
        view = XFormSubmissionApi.as_view({'post': 'create'})
        self._publish_xml_form()
        message = "Successful submission."
        instanceId = '5b2cc313-fc09-437e-8149-fcd32f695d41'
        self.assertRaises(
            Instance.DoesNotExist, Instance.objects.get, uuid=instanceId)
        submission_path = os.path.join(
            self.main_directory, 'fixtures', 'transportation',
            'view', 'submission.xml')
        count = Instance.objects.count()
        with open(submission_path, 'rb') as f:
            post_data = {'xml_submission_file': f}
            request = self.factory.post(self._submission_list_url, post_data)
            response = view(request)
            self.assertEqual(response.status_code, 401)
            auth = DigestAuth('bob', 'bobbob')

            # Rewind the file to avoid the xml parser to get an empty string
            # and throw and parsing error
            f.seek(0)
            # Create a new requests to avoid request.FILES to be empty
            request = self.factory.post(self._submission_list_url, post_data)
            request.META.update(auth(request.META, response))
            response = view(request)
            self.assertContains(response, message, status_code=201)
            self.assertContains(response, instanceId, status_code=201)
            self.assertEqual(Instance.objects.count(), count + 1)

    def tearDown(self):
        if self.user and self.user.username:
            rmdir(self.user.username)
