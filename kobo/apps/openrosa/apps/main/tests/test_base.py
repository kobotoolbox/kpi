# coding: utf-8
import os
import socket
from io import BytesIO
from urllib.request import urlopen
from urllib.error import URLError

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, Permission
from django.test import TestCase
from django.test.client import Client
from django.utils import timezone
from django_digest.test import Client as DigestClient
from kobo_service_account.utils import get_request_headers
from rest_framework.reverse import reverse
from rest_framework.test import APIRequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm, Attachment
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.tests.mixins.make_submission_mixin import MakeSubmissionMixin
from kobo.apps.openrosa.libs.tests.mixins.request_mixin import RequestMixin
from kobo.apps.openrosa.libs.utils.string import base64_encodestring


class TestBase(RequestMixin, MakeSubmissionMixin, TestCase):

    surveys = ['transport_2011-07-25_19-05-49',
               'transport_2011-07-25_19-05-36',
               'transport_2011-07-25_19-06-01',
               'transport_2011-07-25_19-06-14']
    this_directory = os.path.dirname(__file__)

    def setUp(self):
        self.maxDiff = None
        self._create_user_and_login()
        self.base_url = 'http://testserver'
        self.factory = APIRequestFactory()
        self._add_permissions_to_user(AnonymousUser())

    def tearDown(self):
        # clear mongo db after each test
        settings.MONGO_DB.instances.drop()

    def _fixture_path(self, *args):
        return os.path.join(os.path.dirname(__file__), 'fixtures', *args)

    def _add_permissions_to_user(self, user, save=True):
        # Gives `user` unrestricted model-level access to everything listed in
        # `auth_permission`.  Without this, actions
        # on individual instances are immediately denied and object-level permissions
        # are never considered.
        if user.is_anonymous:
            user = User.objects.get(id=settings.ANONYMOUS_USER_ID)
        user.user_permissions.set(Permission.objects.all())
        if save:
            user.save()

    def _create_user(self, username, password):
        user, created = User.objects.get_or_create(username=username)
        user.set_password(password)
        self._add_permissions_to_user(user, save=False)
        user.save()

        return user

    def _login(self, username, password):
        client = Client()
        assert client.login(username=username, password=password)
        return client

    def _logout(self, client=None):
        if not client:
            client = self.client
        client.logout()

    def _create_user_and_login(self, username="bob", password="bob"):
        self.login_username = username
        self.login_password = password
        self.user = self._create_user(username, password)

        # create user profile if it does not exist
        UserProfile.objects.get_or_create(user_id=self.user.pk)

        self.client = self._login(username, password)
        self.anon = Client()

    def _publish_xls_file(self, path, use_service_account=True):

        xform_list_url = reverse('xform-list')

        if not path.startswith(f'/{self.user.username}/'):
            path = os.path.join(self.this_directory, path)

        if use_service_account:
            # Only service account user is allowed to `POST` to XForm API
            client = Client()
            service_account_meta = self.get_meta_from_headers(
                get_request_headers(self.user.username)
            )
            service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        else:
            # For test purposes we want to try to `POST` with current logged-in
            # user
            client = self.client
            service_account_meta = {}

        with open(path, 'rb') as xls_file:
            post_data = {'xls_file': xls_file}
            response = client.post(
                xform_list_url,
                data=post_data,
                **service_account_meta,
            )
            return response

    def _publish_xlsx_file(self):
        path = os.path.join(self.this_directory, 'fixtures', 'exp.xlsx')
        pre_count = XForm.objects.count()
        response = TestBase._publish_xls_file(self, path)
        # make sure publishing the survey worked
        self.assertEqual(response.status_code, 201)
        self.assertEqual(XForm.objects.count(), pre_count + 1)

    def _publish_xls_file_and_set_xform(self, path):
        count = XForm.objects.count()
        self.response = self._publish_xls_file(path)
        self.assertEqual(XForm.objects.count(), count + 1)
        self.xform = XForm.objects.order_by('pk').reverse()[0]

    def _share_form_data(self, id_string='transportation_2011_07_25'):
        xform = XForm.objects.get(id_string=id_string)
        xform.shared_data = True
        xform.save()

    def _publish_transportation_form(self):
        xls_path = os.path.join(
            self.this_directory,
            "fixtures",
            "transportation",
            "transportation.xls",
        )
        count = XForm.objects.count()
        TestBase._publish_xls_file(self, xls_path)
        self.assertEqual(XForm.objects.count(), count + 1)
        self.xform = XForm.objects.order_by('pk').reverse()[0]

    def _submit_transport_instance(self, survey_at=0):
        s = self.surveys[survey_at]
        self._make_submission(os.path.join(
            self.this_directory, 'fixtures',
            'transportation', 'instances', s, s + '.xml'))

    def _submit_transport_instance_w_uuid(self, name):
        self._make_submission(os.path.join(
            self.this_directory, 'fixtures',
            'transportation', 'instances_w_uuid', name, name + '.xml'))

    def _submit_transport_instance_w_attachment(self, survey_at=0):
        s = self.surveys[survey_at]
        media_file = "1335783522563.jpg"
        self._make_submission_w_attachment(
            os.path.join(
                self.this_directory,
                'fixtures',
                'transportation',
                'instances',
                s,
                s + '.xml',
            ),
            os.path.join(
                self.this_directory,
                'fixtures',
                'transportation',
                'instances',
                s,
                media_file,
            ),
        )
        self.attachment = Attachment.objects.all().reverse()[0]
        self.attachment_media_file = str(self.attachment.media_file)

    def _publish_transportation_form_and_submit_instance(self):
        self._publish_transportation_form()
        self._submit_transport_instance()

    def _make_submissions_gps(self):
        surveys = ['gps_1980-01-23_20-52-08',
                   'gps_1980-01-23_21-21-33', ]
        for survey in surveys:
            path = self._fixture_path('gps', 'instances', survey + '.xml')
            self._make_submission(path)

    def _check_url(self, url, timeout=1):
        try:
            urlopen(url, timeout=timeout)
            return True
        except (URLError, socket.timeout):
            pass
        return False

    def _internet_on(self, url='http://74.125.113.99'):
        # default value is some google IP
        return self._check_url(url)

    def _set_auth_headers(self, username, password):
        return {
            'HTTP_AUTHORIZATION':
                'Basic ' + base64_encodestring('%s:%s' % (username, password)),
        }

    def _get_authenticated_client(
            self, url, username='bob', password='bob', extra={}):
        client = DigestClient()
        # request with no credentials
        req = client.get(url, {}, **extra)
        self.assertEqual(req.status_code, 401)
        # apply credentials
        client.set_authorization(username, password, 'Digest')
        return client

    def _get_response_content(self, response):
        contents = ''
        if getattr(response, 'streaming', None):
            actual_content = BytesIO()
            for content in response.streaming_content:
                actual_content.write(content)
            contents = actual_content.getvalue()
            actual_content.close()
        else:
            contents = response.content
        return contents

    def _set_mock_time(self, mock_time):
        current_time = timezone.now()
        mock_time.return_value = current_time
