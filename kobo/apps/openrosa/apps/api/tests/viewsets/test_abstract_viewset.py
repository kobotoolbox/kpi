import os
from typing import Union

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, Permission
from django.core.files.base import ContentFile
from django.test import TestCase
from django_digest.test import DigestAuth
from rest_framework import status
from rest_framework.reverse import reverse
from rest_framework.test import APIRequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.api.viewsets.metadata_viewset import MetaDataViewSet
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.main import tests as main_tests
from kobo.apps.openrosa.apps.main.models import MetaData, UserProfile
from kobo.apps.openrosa.libs.tests.mixins.make_submission_mixin import (
    MakeSubmissionMixin,
)
from kobo.apps.openrosa.libs.tests.mixins.request_mixin import RequestMixin
from kobo.apps.openrosa.libs.utils import logger_tools


class TestAbstractViewSet(RequestMixin, MakeSubmissionMixin, TestCase):
    surveys = ['transport_2011-07-25_19-05-49',
               'transport_2011-07-25_19-05-36',
               'transport_2011-07-25_19-06-01',
               'transport_2011-07-25_19-06-14']
    main_directory = os.path.dirname(main_tests.__file__)

    default_profile_data = {
        'username': 'bob',
        'email': 'bob@columbia.edu',
        'password1': 'bobbob',
        'password2': 'bobbob',
        'name': 'Bob',
        'city': 'Bobville',
        'country': 'US',
        'organization': 'Bob Inc.',
        'home_page': 'bob.com',
        'twitter': 'boberama'
    }

    profile_data = default_profile_data.copy()

    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()
        self._login_user_and_profile()
        self._add_permissions_to_user(AnonymousUser())
        self.maxDiff = None

    def publish_xls_form(
        self, path=None, data=None, assert_creation=True, use_api=False
    ):
        # KoboCAT (v1) API does not allow project creation anymore.
        # Only KPI API allows that. The project can be only added to KoboCAT
        # during deployment. Thus, this method will create the XForm object directly
        # without an API call except if `use_api` is True.

        # Some unit tests still need to test the result of API `v1`
        # (i.e.: KoboCAT API). For example, to ensure project creation is
        # not allowed anymore.
        if not data:
            data = {
                'owner': self.user.username,
                'public': False,
                'public_data': False,
                'description': 'transportation_2011_07_25',
                'downloadable': True,
                'encrypted': False,
                'id_string': 'transportation_2011_07_25',
                'title': 'transportation_2011_07_25',
            }

        if not path:
            path = os.path.join(
                settings.OPENROSA_APP_DIR,
                'apps',
                'main',
                'tests',
                'fixtures',
                'transportation',
                'transportation.xls',
            )

        if use_api is True:
            xform_list_url = reverse('xform-list')
            with open(path, 'rb') as xls_file:
                post_data = {'xls_file': xls_file}
                response = self.client.post(
                    xform_list_url, data=post_data, **self.extra
                )

            if assert_creation is False:
                return response

            self.assertEqual(response.status_code, 201)
            self.xform = XForm.objects.all().order_by('pk').reverse()[0]
            data.update({'url': f'http://testserver/api/v1/forms/{self.xform.pk}'})
            self.assertEqual(dict(response.data, **data), response.data)
            self.form_data = response.data
        else:
            with open(path, 'rb') as f:
                xls_file = ContentFile(f.read(), name='transportation.xls')

            self.xform = logger_tools.publish_xls_form(xls_file, self.user)
            response = self.client.get(
                reverse('xform-detail', kwargs={'pk': self.xform.pk})
            )

            if assert_creation is True:
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.form_data = response.data

    def user_profile_data(self):
        return {
            'id': self.user.pk,
            'url': 'http://testserver/api/v1/profiles/bob',
            'username': 'bob',
            'name': 'Bob',
            'email': 'bob@columbia.edu',
            'city': 'Bobville',
            'country': 'US',
            'organization': 'Bob Inc.',
            'website': 'bob.com',
            'twitter': 'boberama',
            'gravatar': self.user.profile.gravatar,
            'require_auth': False,
            'user': 'http://testserver/api/v1/users/bob',
            'metadata': {},
        }

    def validate_openrosa_head_response(self, response):
        self.assertEqual(response.status_code, 204)
        self.assertFalse(response.data)  # should be empty
        self.assertIn('X-OpenRosa-Accept-Content-Length', response)
        self.assertIn('X-OpenRosa-Version', response)

    def _add_permissions_to_user(self, user, save=True):
        """
        Gives `user` unrestricted model-level access to everything listed in
        `auth_permission`.  Without this, actions on individual instances are
        immediately denied and object-level permissions are never considered.
        """
        if user.is_anonymous:
            user = User.objects.get(id=settings.ANONYMOUS_USER_ID)
        user.user_permissions.set(Permission.objects.all())
        if save:
            user.save()

    def _set_api_permissions(self, user):
        add_userprofile = Permission.objects.get(
            content_type__app_label='main', content_type__model='userprofile',
            codename='add_userprofile')
        user.user_permissions.add(add_userprofile)

    def _create_user_profile(self, extra_post_data={}):
        self.profile_data = dict(self.profile_data)
        self.profile_data.update(extra_post_data)
        user, created = User.objects.get_or_create(
            username=self.profile_data['username'],
            first_name=self.profile_data['name'],
            email=self.profile_data['email'])
        user.set_password(self.profile_data['password1'])
        self._add_permissions_to_user(user, save=False)
        user.save()
        new_profile, created = UserProfile.objects.get_or_create(
            user=user, name=self.profile_data['name'],
            city=self.profile_data['city'],
            country=self.profile_data['country'],
            organization=self.profile_data['organization'],
            home_page=self.profile_data['home_page'],
            twitter=self.profile_data['twitter'],
        )

        return new_profile

    def _login_user_and_profile(self, extra_post_data={}):
        profile = self._create_user_profile(extra_post_data)
        self.user = profile.user
        self.assertTrue(
            self.client.login(username=self.user.username,
                              password=self.profile_data['password1']))
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}

    def _make_submission(
        self,
        path: str,
        username: str = None,
        add_uuid: bool = False,
        forced_submission_time: bool = None,
        auth: Union[DigestAuth, bool] = None,
        media_file: 'io.BufferedReader' = None,
        assert_success: bool = True,
        use_api: bool = True,
    ):
        if auth is None:
            auth = DigestAuth(
                self.profile_data['username'], self.profile_data['password1']
            )

        super()._make_submission(
            path,
            username,
            add_uuid,
            forced_submission_time,
            auth,
            media_file,
            use_api,
        )

    def _make_submissions(self, username=None):

        auth = DigestAuth(
            self.profile_data['username'], self.profile_data['password1']
        )

        super()._make_submissions(
            username, auth, self.main_directory
        )

    def _submit_transport_instance_w_attachment(
        self, survey_at=0, media_file=None, with_namespace=False
    ):
        survey_datetime = self.surveys[survey_at]
        if not media_file:
            media_file = '1335783522563.jpg'
        path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_datetime,
            media_file,
        )

        with open(path, 'rb') as f:
            xml_filename = (
                f'{survey_datetime}_with_xmlns.xml'
                if with_namespace
                else f'{survey_datetime}.xml'
            )
            self._make_submission(
                os.path.join(
                    self.main_directory,
                    'fixtures',
                    'transportation',
                    'instances',
                    survey_datetime,
                    xml_filename,
                ),
                media_file=f,
            )

        attachment = Attachment.objects.all().reverse()[0]
        self.attachment = attachment

    def _post_form_metadata(self, data, test=True):
        count = MetaData.objects.count()
        view = MetaDataViewSet.as_view({'post': 'create'})
        request = self.factory.post('/', data, **self.extra)

        response = view(request)

        if test:
            self.assertEqual(response.status_code, 201)
            another_count = MetaData.objects.count()
            self.assertEqual(another_count, count + 1)
            self.metadata = MetaData.objects.get(pk=response.data['id'])
            self.metadata_data = response.data

        return response

    def _add_form_metadata(
        self, xform, data_type, data_value, path=None, test=True
    ):
        data = {
            'data_type': data_type,
            'data_value': data_value,
            'xform': xform.pk
        }

        if path and data_value:
            with open(path, 'rb') as media_file:
                data.update({
                    'data_file': media_file,
                })
                response = self._post_form_metadata(data, test)
        else:
            response = self._post_form_metadata(data, test)

        return response
