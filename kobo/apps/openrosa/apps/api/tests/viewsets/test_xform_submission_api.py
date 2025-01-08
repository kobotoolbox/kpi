import multiprocessing
import os
from collections import defaultdict
from functools import partial

import pytest
import requests
import simplejson as json
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.test.testcases import LiveServerTestCase
from django_digest.test import DigestAuth
from rest_framework.authtoken.models import Token

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.tests.mixins.request_mixin import RequestMixin
from rest_framework import status

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import (
    TestAbstractViewSet,
)
from kobo.apps.openrosa.apps.api.viewsets.xform_submission_api import XFormSubmissionApi
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.main import tests as main_tests
from kobo.apps.openrosa.libs.constants import CAN_ADD_SUBMISSIONS
from kobo.apps.openrosa.libs.utils.guardian import assign_perm
from kobo.apps.openrosa.libs.utils import logger_tools
from kobo.apps.openrosa.libs.utils.logger_tools import (
    OpenRosaResponseNotAllowed,
    OpenRosaTemporarilyUnavailable,
)


class TestXFormSubmissionApi(TestAbstractViewSet):
    def setUp(self):
        super().setUp()
        self.view = XFormSubmissionApi.as_view({'head': 'create', 'post': 'create'})
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
        media_file = '1335783522563.jpg'
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
                    'Instance ID is required'
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
                self.assertContains(response, 'Access denied', status_code=403)

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
        data = {'id': 'transportation_2011_07_25'}
        request = self.factory.post('/submission', data, format='json')
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

        # redo the request since it's been consumed
        request = self.factory.post('/submission', data, format='json')
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        response = self.view(request)
        self.assertContains(response, 'No submission key provided.', status_code=400)

    def test_submission_account_inactive(self):
        """
        Verify that submissions are blocked when the owning user has
        `is_active = False`
        """
        self.xform.user.is_active = False
        self.xform.user.save()

        # No need auth for this test
        self.xform.require_auth = False
        self.xform.save(update_fields=['require_auth'])

        s = self.surveys[0]
        username = self.user.username
        submission_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            s,
            s + '.xml',
        )
        with open(submission_path) as sf:
            request = self.factory.post(
                f'/{username}/submission', {'xml_submission_file': sf}
            )
            request.user = AnonymousUser()

            # Ensure that submissions are not accepted since the owning user is
            # inactive
            response = self.view(request, username=username)
            self.assertEqual(
                response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
            )
            self.assertTrue(isinstance(response, OpenRosaResponseNotAllowed))

    def test_submission_blocking_flag(self):
        # Set 'submissions_suspended' True in the profile to test if
        # submission does fail with the flag set
        self.xform.user.profile.submissions_suspended = True
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
                self.xform.user.profile.submissions_suspended = False
                self.xform.user.profile.save()

                request = self.factory.post(
                    f'/{username}/submission', data
                )
                response = self.view(request, username=username)
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_submission_customizable_confirmation_message(self):
        s = 'transport_with_custom_attribute'
        media_file = '1335783522563.jpg'
        xml_files = [
            'transport_with_custom_attribute_01',
            'transport_with_custom_attribute_02',
            'transport_with_no_custom_attribute'
        ]

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
            for xml_file in xml_files:
                submission_path = os.path.join(
                    self.main_directory,
                    'fixtures',
                    'transportation',
                    'instances',
                    s,
                    xml_file + '.xml',
                )
                with open(submission_path) as sf:
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
                    if xml_file == 'transport_with_custom_attribute_01':
                        self.assertContains(
                            response, 'Custom submit message', status_code=201
                        )
                    elif xml_file == 'transport_with_custom_attribute_02':
                        self.assertContains(
                            response, 'Successful submission.', status_code=201
                        )
                    elif xml_file == (
                        'transport_with_custom_attribute_and_different_root'
                    ):
                        self.assertContains(
                            response, 'Custom submit message', status_code=201
                        )
                    else:
                        self.assertContains(
                            response, 'Successful submission.', status_code=201
                        )


class ConcurrentSubmissionTestCase(RequestMixin, LiveServerTestCase):
    """
    Inherit from LiveServerTestCase to be able to test concurrent requests
    to submission endpoint in different transactions (and different processes).
    Otherwise, DB is populated only on the first request but still empty on
    subsequent ones.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='bob', password='bob', email='bob@columbia.edu'
        )
        self.token, _ = Token.objects.get_or_create(user=self.user)
        UserProfile.objects.get_or_create(user=self.user)

    def publish_xls_form(self):
        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.xls',
        )

        with open(path, 'rb') as f:
            xls_file = ContentFile(f.read(), name='transportation.xls')

        self.xform = logger_tools.publish_xls_form(xls_file, self.user)

    @pytest.mark.skipif(
        settings.SKIP_TESTS_WITH_CONCURRENCY,
        reason='GitLab does not seem to support multi-processes'
    )
    def test_post_concurrent_same_submissions(self):
        DUPLICATE_SUBMISSIONS_COUNT = 2  # noqa

        self.publish_xls_form()
        username = 'bob'
        survey = 'transport_2011-07-25_19-05-49'
        results = defaultdict(int)

        with multiprocessing.Pool() as pool:
            for result in pool.map(
                partial(
                    submit_data,
                    live_server_url=self.live_server_url,
                    survey_=survey,
                    username_=username,
                    token_=self.token.key
                ),
                range(DUPLICATE_SUBMISSIONS_COUNT),
            ):
                results[result] += 1

        assert results[status.HTTP_201_CREATED] == 1
        assert results[status.HTTP_202_ACCEPTED] == DUPLICATE_SUBMISSIONS_COUNT - 1


def submit_data(identifier, survey_, username_, live_server_url, token_):
    """
    Submit data to live server.

    It has to be outside `ConcurrentSubmissionTestCase` class to be pickled by
    `multiprocessing.Pool().map()`.
    """
    media_file = '1335783522563.jpg'
    main_directory = os.path.dirname(main_tests.__file__)
    path = os.path.join(
        main_directory,
        'fixtures',
        'transportation',
        'instances',
        survey_,
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
            main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_,
            f'{survey_}.xml',
        )
        with open(submission_path) as sf:
            files = {'xml_submission_file': sf, 'media_file': f}
            headers = {'Authorization': f'Token {token_}'}
            response = requests.post(
                f'{live_server_url}/{username_}/submission',
                files=files,
                headers=headers
            )
            return response.status_code
