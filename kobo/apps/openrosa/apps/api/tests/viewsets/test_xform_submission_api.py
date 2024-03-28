# coding: utf-8
import os
import uuid

import simplejson as json
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import InMemoryUploadedFile
from django_digest.test import DigestAuth
from kobo.apps.openrosa.libs.utils.guardian import assign_perm
from kobo_service_account.utils import get_request_headers
from rest_framework import status

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import \
    TestAbstractViewSet
from kobo.apps.openrosa.apps.api.viewsets.xform_submission_api import XFormSubmissionApi
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.libs.constants import (
    CAN_ADD_SUBMISSIONS
)
from kobo.apps.openrosa.libs.utils.logger_tools import OpenRosaTemporarilyUnavailable


class TestXFormSubmissionApi(TestAbstractViewSet):
    def setUp(self):
        super().setUp()
        self.view = XFormSubmissionApi.as_view({
            "head": "create",
            "post": "create"
        })
        self.publish_xls_form()

    def test_head_response(self):
        request = self.factory.head('/submission')
        response = self.view(request)
        self.assertEqual(response.status_code, 401)
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.validate_openrosa_head_response(response)

    def test_post_submission_anonymous(self):

        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])

        s = self.surveys[0]
        media_file = '1335783522563.jpg'
        path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            s,
            media_file,
        )
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(
                f,
                'media_file',
                media_file,
                'image/jpg',
                os.path.getsize(path),
                None,
            )
            submission_path = os.path.join(
                self.main_directory,
                'fixtures',
                'transportation',
                'instances',
                s,
                s + '.xml',
            )
            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post(
                    f'/{self.user.username}/submission', data
                )
                request.user = AnonymousUser()

                response = self.view(request, username=self.user.username)
                self.assertContains(
                    response, 'Successful submission', status_code=201
                )
                self.assertTrue(response.has_header('X-OpenRosa-Version'))
                self.assertTrue(
                    response.has_header('X-OpenRosa-Accept-Content-Length')
                )
                self.assertTrue(response.has_header('Date'))
                self.assertEqual(
                    response['Content-Type'], 'text/xml; charset=utf-8'
                )
                self.assertEqual(
                    response['Location'],
                    f'http://testserver/{self.user.username}/submission',
                )

    def test_post_submission_authenticated(self):
        s = self.surveys[0]
        media_file = '1335783522563.jpg'
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)

            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')

            with open(submission_path, 'rb') as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)

                # rewind the file and redo the request since they were
                # consumed
                sf.seek(0)
                f.seek(0)
                request = self.factory.post('/submission', data)
                auth = DigestAuth('bob', 'bobbob')
                request.META.update(auth(request.META, response))
                response = self.view(request, username=self.user.username)
                self.assertContains(response, 'Successful submission',
                                    status_code=201)
                self.assertTrue(response.has_header('X-OpenRosa-Version'))
                self.assertTrue(
                    response.has_header('X-OpenRosa-Accept-Content-Length'))
                self.assertTrue(response.has_header('Date'))
                self.assertEqual(response['Content-Type'],
                                 'text/xml; charset=utf-8')
                self.assertEqual(response['Location'],
                                 'http://testserver/submission')

    def test_post_submission_uuid_other_user_username_not_provided(self):
        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        self._create_user_profile(alice_data)
        s = self.surveys[0]
        media_file = "1335783522563.jpg"
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')
            path = self._add_uuid_to_submission_xml(path, self.xform)

            with open(path, 'rb') as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)

                # rewind the file and redo the request since they were
                # consumed
                sf.seek(0)
                request = self.factory.post('/submission', data)
                auth = DigestAuth('alice', 'alicealice')
                request.META.update(auth(request.META, response))
                response = self.view(request)
                self.assertEqual(response.status_code, 403)

    def test_post_submission_authenticated_json(self):
        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '..',
            'fixtures',
            'transport_submission.json')
        with open(path, 'rb') as f:
            data = json.loads(f.read())
            request = self.factory.post('/submission', data, format='json')
            response = self.view(request)
            self.assertEqual(response.status_code, 401)

            # redo the request since it were consumed
            request = self.factory.post('/submission', data, format='json')
            auth = DigestAuth('bob', 'bobbob')
            request.META.update(auth(request.META, response))

            response = self.view(request)
            self.assertContains(response, 'Successful submission',
                                status_code=201)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(
                response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'],
                             'application/json')
            self.assertEqual(response['Location'],
                             'http://testserver/submission')

    def test_post_submission_authenticated_bad_json(self):
        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '..',
            'fixtures',
            'transport_submission_bad.json')
        with open(path) as f:
            data = json.loads(f.read())
            request = self.factory.post('/submission', data, format='json')
            response = self.view(request)
            self.assertEqual(response.status_code, 401)

            request = self.factory.post('/submission', data, format='json')
            auth = DigestAuth('bob', 'bobbob')
            request.META.update(auth(request.META, response))
            response = self.view(request)
            rendered_response = response.render()
            self.assertTrue('error' in rendered_response.data)
            self.assertTrue(
                rendered_response.data['error'].startswith(
                    'Received empty submission'
                )
            )
            self.assertTrue(rendered_response.status_code == 400)
            self.assertTrue(rendered_response.has_header('X-OpenRosa-Version'))
            self.assertTrue(
                rendered_response.has_header('X-OpenRosa-Accept-Content-Length'))
            self.assertTrue(rendered_response.has_header('Date'))
            self.assertEqual(rendered_response['Content-Type'],
                             'application/json')
            self.assertEqual(rendered_response['Location'],
                             'http://testserver/submission')

    def test_post_submission_require_auth(self):
        count = Attachment.objects.count()
        s = self.surveys[0]
        media_file = "1335783522563.jpg"
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')

            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)
                response = self.view(request, username=self.user.username)
                self.assertEqual(response.status_code, 401)

                # rewind the file and redo the request since they were
                # consumed
                sf.seek(0)
                request = self.factory.post('/submission', data)
                auth = DigestAuth('bob', 'bobbob')
                request.META.update(auth(request.META, response))
                response = self.view(request, username=self.user.username)
                self.assertContains(response, 'Successful submission',
                                    status_code=201)
                self.assertEqual(count + 1, Attachment.objects.count())
                self.assertTrue(response.has_header('X-OpenRosa-Version'))
                self.assertTrue(
                    response.has_header('X-OpenRosa-Accept-Content-Length'))
                self.assertTrue(response.has_header('Date'))
                self.assertEqual(response['Content-Type'],
                                 'text/xml; charset=utf-8')
                self.assertEqual(response['Location'],
                                 'http://testserver/submission')

    def test_post_submission_require_auth_anonymous_user(self):
        count = Attachment.objects.count()
        s = self.surveys[0]
        media_file = "1335783522563.jpg"
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')
            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)
                response = self.view(request, username=self.user.username)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(count, Attachment.objects.count())

    def test_post_submission_require_auth_other_user(self):

        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        self._create_user_profile(alice_data)

        count = Attachment.objects.count()
        s = self.surveys[0]
        media_file = "1335783522563.jpg"
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')
            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)
                response = self.view(request, username=self.user.username)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(count, Attachment.objects.count())

                # rewind the file and redo the request since they were
                # consumed
                sf.seek(0)
                request = self.factory.post('/submission', data)
                auth = DigestAuth('alice', 'alicealice')
                request.META.update(auth(request.META, response))
                response = self.view(request, username=self.user.username)
                self.assertContains(response, 'Forbidden', status_code=403)

    def test_post_submission_require_auth_data_entry_role(self):

        alice_data = {
            'username': 'alice',
            'password1': 'alicealice',
            'password2': 'alicealice',
            'email': 'alice@localhost.com',
        }
        alice_profile = self._create_user_profile(alice_data)

        assign_perm(CAN_ADD_SUBMISSIONS, alice_profile.user, self.xform)

        count = Attachment.objects.count()
        s = self.surveys[0]
        media_file = "1335783522563.jpg"
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')
            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post('/submission', data)
                response = self.view(request)
                self.assertEqual(response.status_code, 401)
                response = self.view(request, username=self.user.username)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(count, Attachment.objects.count())

                # rewind the file and redo the request since they were
                # consumed
                sf.seek(0)
                request = self.factory.post('/submission', data)
                auth = DigestAuth('alice', 'alicealice')
                request.META.update(auth(request.META, response))
                response = self.view(request, username=self.user.username)
                self.assertContains(response, 'Successful submission',
                                    status_code=201)

    def test_post_submission_json_without_submission_key(self):
        data = {"id": "transportation_2011_07_25"}
        request = self.factory.post('/submission', data, format='json')
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

        # redo the request since it's been consumed
        request = self.factory.post('/submission', data, format='json')
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertContains(response, 'No submission key provided.',
                            status_code=400)

    def test_edit_submission_with_service_account(self):
        """
        Simulate KPI duplicating/editing feature, i.e. resubmit existing
        submission with a different UUID (and a deprecatedID).
        """

        # Ensure only authenticated users can submit data
        path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '..',
            'fixtures',
            'transport_submission.json')
        with open(path, 'rb') as f:
            data = json.loads(f.read())

            # Submit data as Bob
            request = self.factory.post(
                '/submission', data, format='json', **self.extra
            )
            response = self.view(request)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

            # Create user without edit permissions ('change_xform' and 'report_xform')
            alice_data = {
                'username': 'alice',
                'password1': 'alicealice',
                'password2': 'alicealice',
                'email': 'alice@localhost.com',
            }
            self._login_user_and_profile(alice_data)

            new_uuid = f'uuid:{uuid.uuid4()}'
            data['submission']['meta'] = {
                'instanceID': new_uuid,
                'deprecatedID': data['submission']['meta']['instanceID']
            }
            # New ODK form. Let's provide a uuid.
            data['submission'].update({
                'formhub': {
                    'uuid': self.xform.uuid
                }
            })

            request = self.factory.post(
                '/submission', data, format='json', **self.extra
            )
            response = self.view(request)
            # Alice should get access forbidden.
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

            # Try to submit with service account user on behalf of alice
            service_account_meta = self.get_meta_from_headers(
                get_request_headers('alice')
            )
            # Test server does not provide `host` header
            service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
            request = self.factory.post(
                '/submission', data, format='json', **service_account_meta
            )
            response = self.view(request)
            self.assertContains(response, 'Successful submission',
                                status_code=status.HTTP_201_CREATED)
            self.assertTrue(response.has_header('X-OpenRosa-Version'))
            self.assertTrue(
                response.has_header('X-OpenRosa-Accept-Content-Length')
            )
            self.assertTrue(response.has_header('Date'))
            self.assertEqual(response['Content-Type'], 'application/json')
            self.assertEqual(
                response['Location'], 'http://testserver/submission'
            )

    def test_submission_blocking_flag(self):
        # Set 'submissions_suspended' True in the profile metadata to test if
        # submission do fail with the flag set
        self.xform.user.profile.metadata['submissions_suspended'] = True
        self.xform.user.profile.save()

        # No need auth for this test
        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])

        s = self.surveys[0]
        username = self.user.username
        media_file = '1335783522563.jpg'
        path = os.path.join(self.main_directory, 'fixtures',
                            'transportation', 'instances', s, media_file)

        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(f, 'media_file', media_file, 'image/jpg',
                                     os.path.getsize(path), None)
            submission_path = os.path.join(
                self.main_directory, 'fixtures',
                'transportation', 'instances', s, s + '.xml')
            with open(submission_path) as sf:
                data = {'xml_submission_file': sf, 'media_file': f}
                request = self.factory.post(
                    f'/{username}/submission', data
                )
                request.user = AnonymousUser()
                response = self.view(request, username=username)

                # check to make sure the `submission_suspended` flag stops the submission
                self.assertEqual(
                    response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE
                )
                self.assertTrue(
                    isinstance(response, OpenRosaTemporarilyUnavailable)
                )

                # Files have been read during previous request, bring back
                # their pointer position to zero to submit again.
                sf.seek(0)
                f.seek(0)

                # check that users can submit data again when flag is removed
                self.xform.user.profile.metadata['submissions_suspended'] = False
                self.xform.user.profile.save()

                request = self.factory.post(
                    f'/{username}/submission', data
                )
                response = self.view(request, username=username)
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
