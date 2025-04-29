# coding: utf-8
from django.test import RequestFactory
from rest_framework import status

from kobo.apps.openrosa.apps.api.viewsets.data_viewset import DataViewSet
from kobo.apps.openrosa.apps.api.viewsets.xform_viewset import XFormViewSet
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.constants import (
    CAN_CHANGE_XFORM,
    CAN_DELETE_DATA_XFORM,
    CAN_VIEW_XFORM,
)
from kobo.apps.openrosa.libs.utils.guardian import assign_perm, remove_perm


def _data_list(formid):
    return [{
        'id': formid,
        'id_string': 'transportation_2011_07_25',
        'title': 'transportation_2011_07_25',
        'description': 'transportation_2011_07_25',
        'url': 'http://testserver/api/v1/data/%s' % formid
    }]


def _data_instance(dataid):
    return {
        '_attachments': [],
        '_geolocation': [None, None],
        '_xform_id_string': 'transportation_2011_07_25',
        'transport/available_transportation_types_to_referral_facility':
        'none',
        '_status': 'submitted_via_web',
        '_id': dataid
    }


class TestDataViewSet(TestBase):

    def setUp(self):
        super().setUp()
        self._create_user_and_login()
        self._publish_transportation_form()
        self.factory = RequestFactory()
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}

    def test_data(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})

        # Access the list endpoint as Bob
        request = self.factory.get('/', **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        formid = self.xform.pk
        data = _data_list(formid)
        self.assertEqual(response.data, data)

        # Access the data endpoint as Bob; reinitialize `request` since it has
        # already been consumed within the previous block
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())

        dataid = self.xform.instances.all().order_by('id')[0].pk
        data = _data_instance(dataid)
        response_first_element = sorted(response.data, key=lambda x: x['_id'])[0]
        self.assertEqual(dict(response_first_element, **data),
                         response_first_element)

        view = DataViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=formid, dataid=dataid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertEqual(dict(response.data, **data),
                         response.data)

    def test_data_anon(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/')
        formid = self.xform.pk
        response = view(request, pk=formid)
        # data not found for anonymous access to private data
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.xform.shared_data = True
        self.xform.save()
        response = view(request, pk=formid)
        # access to a public data
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())
        dataid = self.xform.instances.all().order_by('id')[0].pk
        data = _data_instance(dataid)
        response_first_element = sorted(response.data, key=lambda x: x['_id'])[0]
        self.assertEqual(dict(response_first_element, **data),
                         response_first_element)

        data = {
            '_xform_id_string': 'transportation_2011_07_25',
            'transport/available_transportation_types_to_referral_facility':
            'none',
            '_submitted_by': 'bob',
        }

        view = DataViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=formid, dataid=dataid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertEqual(dict(response.data, **data),
                         response.data)

    def test_data_bad_formid(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        formid = self.xform.pk
        data = _data_list(formid)
        self.assertEqual(response.data, data)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        formid = 98918
        self.assertEqual(XForm.objects.filter(pk=formid).count(), 0)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_data_bad_dataid(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        formid = self.xform.pk
        data = _data_list(formid)
        self.assertEqual(response.data, data)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())
        dataid = 'INVALID'
        data = _data_instance(dataid)
        view = DataViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=formid, dataid=dataid)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_data_with_query_parameter(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        formid = self.xform.pk
        dataid = self.xform.instances.all()[0].pk
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        query_str = '{"_id": "%s"}' % dataid
        request = self.factory.get('/?query=%s' % query_str, **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_anon_data_list(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/')
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_form_tag_propagates_to_data_tags(self):
        """Test that when a tag is applied on an xform,
        it propagates to the instance submissions
        """
        self._make_submissions()
        xform = XForm.objects.all()[0]
        pk = xform.id
        view = XFormViewSet.as_view({
            'get': 'labels',
            'post': 'labels',
            'delete': 'labels'
        })
        # no tags
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=pk)
        self.assertEqual(response.data, [])
        # add tag "hello"
        request = self.factory.post('/', data={'tags': 'hello'}, **self.extra)
        response = view(request, pk=pk)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data, ['hello'])
        for i in self.xform.instances.all():
            self.assertIn('hello', i.tags.names())
        # remove tag "hello"
        request = self.factory.delete('/', data={'tags': 'hello'}, **self.extra)
        response = view(request, pk=pk, label='hello')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
        for i in self.xform.instances.all():
            self.assertNotIn('hello', i.tags.names())

    def test_labels_action_with_params(self):
        self._make_submissions()
        xform = XForm.objects.all()[0]
        pk = xform.id
        dataid = xform.instances.all()[0].id
        view = DataViewSet.as_view({
            'get': 'labels'
        })

        request = self.factory.get('/', **self.extra)
        response = view(request, pk=pk, dataid=dataid, label='hello')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_data_list_filter_by_user(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        formid = self.xform.pk
        bobs_data = _data_list(formid)[0]

        previous_user = self.user
        self._create_user_and_login('alice', 'alice')
        self.assertEqual(self.user.username, 'alice')
        self.assertNotEqual(previous_user, self.user)

        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)

        # publish alice's form
        self._publish_transportation_form()

        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}
        formid = self.xform.pk
        alice_data = _data_list(formid)[0]

        request = self.factory.get('/', **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # should be both bob's and alice's form
        sorted_response_data = sorted(response.data, key=lambda x: x['id'])
        self.assertEqual(sorted_response_data,
                         [bobs_data, alice_data])

        # apply filter, see only bob's forms
        request = self.factory.get('/', data={'owner': 'bob'}, **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [bobs_data])

        # apply filter, see only alice's forms
        request = self.factory.get('/', data={'owner': 'alice'}, **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [alice_data])

        # apply filter, see a non existent user
        request = self.factory.get('/', data={'owner': 'noone'}, **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_get_form_public_data(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/')
        formid = self.xform.pk
        response = view(request, pk=formid)

        # data not found for anonymous access to private data
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.xform.shared = True
        self.xform.shared_data = True
        self.xform.save()

        # access to a public data as anon
        response = view(request, pk=formid)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())
        dataid = self.xform.instances.all().order_by('id')[0].pk
        data = _data_instance(dataid)
        response_first_element = sorted(response.data, key=lambda x: x['_id'])[0]
        self.assertEqual(dict(response_first_element, **data),
                         response_first_element)

        # access to a public data as other user
        self._create_user_and_login('alice', 'alice')
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token}
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=formid)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())
        dataid = self.xform.instances.all().order_by('id')[0].pk
        data = _data_instance(dataid)
        response_first_element = sorted(response.data, key=lambda x: x['_id'])[0]
        self.assertEqual(dict(response_first_element, **data),
                         response_first_element)

    def test_data_w_attachment(self):
        self._submit_transport_instance_w_attachment()

        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        formid = self.xform.pk
        data = _data_list(formid)
        self.assertEqual(response.data, data)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(self.xform.instances.count())
        dataid = self.xform.instances.all().order_by('id')[0].pk

        data = {
            '_attachments': [{'download_url': self.attachment.secure_url(),
                               'download_small_url': self.attachment.secure_url('small'),
                               'download_medium_url': self.attachment.secure_url('medium'),
                               'download_large_url': self.attachment.secure_url('large'),
                               'mimetype': self.attachment.mimetype,
                               'instance': self.attachment.instance.pk,
                               'filename': self.attachment.media_file.name,
                               'id': self.attachment.pk,
                               'uid': self.attachment.uid,
                               'xform': self.xform.id}
                              ],
            '_geolocation': [None, None],
            '_xform_id_string': 'transportation_2011_07_25',
            'transport/available_transportation_types_to_referral_facility':
            'none',
            '_status': 'submitted_via_web',
            '_id': dataid
        }
        response_first_element = sorted(response.data, key=lambda x: x['_id'])[0]
        self.assertEqual(dict(response_first_element, **data),
                         response_first_element)

        data = {
            '_xform_id_string': 'transportation_2011_07_25',
            'transport/available_transportation_types_to_referral_facility':
            'none',
            '_submitted_by': 'bob',
        }

        view = DataViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=formid, dataid=dataid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertEqual(dict(response.data, **data),
                         response.data)

    def test_delete_submission(self):
        self._make_submissions()
        before_count = self.xform.instances.all().count()
        view = DataViewSet.as_view({'delete': 'destroy'})
        request = self.factory.delete('/', **self.extra)
        formid = self.xform.pk
        dataid = self.xform.instances.all().order_by('id')[0].pk

        response = view(request, pk=formid, dataid=dataid)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        count = self.xform.instances.all().count()
        self.assertEqual(before_count - 1, count)

    def test_cannot_delete_submission_as_granted_user(self):
        self._make_submissions()
        before_count = self.xform.instances.all().count()
        view = DataViewSet.as_view({'delete': 'destroy'})
        request = self.factory.delete('/', **self.extra)
        formid = self.xform.pk

        self._create_user_and_login(username='alice', password='alice')
        # Allow Alice to delete submissions.
        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)
        assign_perm(CAN_CHANGE_XFORM, self.user, self.xform)
        self.extra = {'HTTP_AUTHORIZATION': f'Token {self.user.auth_token}'}
        request = self.factory.delete('/', **self.extra)
        dataid = self.xform.instances.all().order_by('id')[0].pk
        response = view(request, pk=formid, dataid=dataid)

        # Alice cannot delete submissions with `CAN_CHANGE_XFORM`
        self.assertContains(
            response,
            'This is not supported by the legacy API anymore',
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

        # Even with correct permissions, Alice should not be able to delete
        remove_perm(CAN_CHANGE_XFORM, self.user, self.xform)
        assign_perm(CAN_DELETE_DATA_XFORM, self.user, self.xform)
        response = view(request, pk=formid, dataid=dataid)
        self.assertContains(
            response,
            'This is not supported by the legacy API anymore',
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_cannot_access_data_of_pending_delete_xform(self):
        # Ensure bob is able to see their data
        self.test_data()

        # Flag bob's xform as pending delete
        self.xform.pending_delete = True
        self.xform.save(update_fields=['pending_delete'])

        # Ensure XForm data is not accessible anymore
        request = self.factory.get('/', **self.extra)
        view = DataViewSet.as_view({'get': 'list'})
        response = view(request, pk=self.xform.pk)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_data_with_custom_handler(self):
        request = self.factory.get('/', **self.extra)
        view = DataViewSet.as_view({'get': 'list'})
        response = view(request, pk=self.xform.pk, format='xlsx')
        assert response.status_code == status.HTTP_200_OK
        assert response.headers['Content-Type'] == 'application/vnd.openxmlformats'

    def test_list_data_with_custom_handler_and_date_range(self):
        qs_params = '?start=21_10_17_00_00_00&end=23_12_01_00_00_00'
        request = self.factory.get(f'/{qs_params}', **self.extra)
        view = DataViewSet.as_view({'get': 'list'})
        response = view(request, pk=self.xform.pk, format='xlsx')
        assert response.status_code == status.HTTP_200_OK
        assert response.headers['Content-Type'] == 'application/vnd.openxmlformats'

    def test_query_counts(self):
        self._make_submissions()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        formid = self.xform.pk
        with self.assertNumQueries(10):
            view(request, pk=formid)
        # test adding submissions does not increase query count
        self._make_submissions()
        self._make_submissions()
        with self.assertNumQueries(10):
            view(request, pk=formid)

    def test_query_counts_with_attachments(self):
        self._submit_transport_instance_w_attachment()
        self._submit_transport_instance_w_attachment()
        view = DataViewSet.as_view({'get': 'list'})
        request = self.factory.get('/', **self.extra)
        formid = self.xform.pk
        with self.assertNumQueries(10):
            view(request, pk=formid)
        self._submit_transport_instance_w_attachment()
        self._submit_transport_instance_w_attachment()
        with self.assertNumQueries(10):
            view(request, pk=formid)
