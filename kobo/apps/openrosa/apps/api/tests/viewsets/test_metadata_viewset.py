# coding: utf-8
import os

from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework import status

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import (
    TestAbstractViewSet,
)
from kobo.apps.openrosa.apps.api.viewsets.metadata_viewset import MetaDataViewSet
from kobo.apps.openrosa.apps.api.viewsets.xform_viewset import XFormViewSet
from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.libs.constants import CAN_CHANGE_XFORM, CAN_VIEW_XFORM
from kobo.apps.openrosa.libs.serializers.xform_serializer import XFormSerializer
from kobo.apps.openrosa.libs.utils.guardian import assign_perm


class TestMetaDataViewSet(TestAbstractViewSet):
    def setUp(self):
        super().setUp()
        self.view = MetaDataViewSet.as_view({
            'delete': 'destroy',
            'get': 'retrieve',
            'post': 'create'
        })
        self.publish_xls_form()
        self.data_value = 'screenshot.png'
        self.fixture_dir = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
        )
        self.path = os.path.join(self.fixture_dir, self.data_value)

        self.alice_profile_data = {
            'username': 'alice',
            'email': 'alice@kobotoolbox.org',
            'password1': 'alice',
            'password2': 'alice',
            'name': 'Alice',
            'city': 'AliceTown',
            'country': 'CA',
            'organization': 'Alice Inc.',
            'home_page': 'alice.com',
            'twitter': 'alicetwitter'
        }

        alice_profile = self._create_user_profile(self.alice_profile_data)
        self.alice = alice_profile.user

    def test_add_metadata_with_file_attachment(self):
        for data_type in ['supporting_doc', 'media', 'source']:
            self._add_form_metadata(self.xform, data_type,
                                    self.data_value, self.path)

    def test_forms_endpoint_with_metadata(self):
        for data_type in ['supporting_doc', 'media', 'source']:
            self._add_form_metadata(self.xform, data_type,
                                    self.data_value, self.path)
        # /forms
        view = XFormViewSet.as_view({
            'get': 'retrieve'
        })
        formid = self.xform.pk
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, 200)
        data = XFormSerializer(self.xform, context={'request': request}).data
        self.assertEqual(response.data, data)

    def test_get_metadata_with_file_attachment(self):
        for data_type in ['supporting_doc', 'media', 'source']:
            self._add_form_metadata(self.xform, data_type,
                                    self.data_value, self.path)
            request = self.factory.get('/', **self.extra)
            response = self.view(request, pk=self.metadata.pk)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, self.metadata_data)
            ext = self.data_value[self.data_value.rindex('.') + 1:]
            request = self.factory.get('/', **self.extra)
            response = self.view(request, pk=self.metadata.pk, format=ext)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response['Content-Type'], 'image/png')

    def test_delete_metadata(self):
        for data_type in ['supporting_doc', 'media', 'source']:
            count = MetaData.objects.count()
            self._add_form_metadata(self.xform, data_type,
                                    self.data_value, self.path)
            request = self.factory.delete('/', **self.extra)
            response = self.view(request, pk=self.metadata.pk)
            self.assertEqual(response.status_code, 204)
            self.assertEqual(count, MetaData.objects.count())

    def test_windows_csv_file_upload_to_metadata(self):
        data_value = 'transportation.csv'
        path = os.path.join(self.fixture_dir, data_value)
        with open(path, 'rb') as f:
            f = InMemoryUploadedFile(
                f, 'media', data_value, 'text/csv', 2625, None)
            data = {
                'data_value': data_value,
                'data_file': f,
                'data_type': 'media',
                'xform': self.xform.pk
            }
            self._post_form_metadata(data)
            self.assertEqual(self.metadata.data_file_type, 'text/csv')

    def test_add_media_url(self):
        data_type = 'media'
        data_value = 'https://devtrac.ona.io/fieldtrips.csv'
        self._add_form_metadata(self.xform, data_type, data_value)
        request = self.factory.get('/', **self.extra)
        ext = self.data_value[self.data_value.rindex('.') + 1:]
        response = self.view(request, pk=self.metadata.pk, format=ext)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], data_value)

    def test_add_invalid_media_url(self):
        data = {
            'data_value': 'httptracfieldtrips.csv',
            'data_type': 'media',
            'xform': self.xform.pk
        }
        response = self._post_form_metadata(data, False)
        self.assertEqual(response.status_code, 400)
        error = {'data_value': [f"Invalid url {data['data_value']}"]}
        self.assertTrue('data_value' in response.data)
        error_details = [
            str(error_detail) for error_detail in response.data['data_value']
        ]
        self.assertEqual(error_details, error['data_value'])

    def test_invalid_post(self):
        response = self._post_form_metadata({}, False)
        self.assertEqual(response.status_code, 400)
        response = self._post_form_metadata({
            'data_type': 'supporting_doc'}, False)
        self.assertEqual(response.status_code, 400)
        response = self._post_form_metadata({
            'data_type': 'supporting_doc',
            'xform': self.xform.pk
        }, False)
        self.assertEqual(response.status_code, 400)

    def _add_test_metadata(self):
        for data_type in ['supporting_doc', 'media', 'source']:
            self._add_form_metadata(self.xform, data_type,
                                    self.data_value, self.path)

    def test_list_metadata(self):
        self._add_test_metadata()
        self.view = MetaDataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)

    def test_list_metadata_for_specific_form(self):
        self._add_test_metadata()
        self.view = MetaDataViewSet.as_view({'get': 'list'})
        data = {'xform': self.xform.pk}

        # Access with anonymous user
        request = self.factory.get('/', data)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

        # Access with user bob
        request = self.factory.get('/', data, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue('xform' in response.data[0])
        self.assertTrue(response.data[0]['xform'], self.xform.pk)

        data['xform'] = 1234509909
        request = self.factory.get('/', data, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 404)

        data['xform'] = 'INVALID'
        request = self.factory.get('/', data, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, 400)

    def test_add_metadata_to_not_allowed_xform(self):
        # Create a project with a different user
        self._login_user_and_profile(extra_post_data=self.alice_profile_data)
        # `self.xform` is now owned by alice
        self.publish_xls_form()

        # Log in as the default user (i.e.: bob)
        self._login_user_and_profile(extra_post_data=self.default_profile_data)
        # Try to add metadata to alice's XForm. It should be rejected
        response = self._add_form_metadata(
            self.xform, 'media', self.data_value, self.path, test=False
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('xform' in response.data)
        self.assertTrue(response.data['xform'], 'Project not found')

        # Try with view permission
        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)
        response = self._add_form_metadata(
            self.xform, 'media', self.data_value, self.path, test=False
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('xform' in response.data)
        self.assertTrue(
            response.data['xform'],
            'You do not have sufficient permissions to perform this action',
        )

    def test_add_metadata_to_shared_xform(self):
        # Create a project with a different user
        self._login_user_and_profile(extra_post_data=self.alice_profile_data)
        # `self.xform` is now owned by alice
        self.publish_xls_form()

        # Log in as the default user (i.e.: bob)
        self._login_user_and_profile(extra_post_data=self.default_profile_data)

        # Give bob write access to alice's xform
        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)
        assign_perm(CAN_CHANGE_XFORM, self.user, self.xform)

        # Try to add metadata to alice's XForm.
        self._add_test_metadata()
