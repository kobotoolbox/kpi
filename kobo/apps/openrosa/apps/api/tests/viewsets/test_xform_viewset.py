# coding: utf-8
import os
from xml.dom import Node

import pytest
from defusedxml import minidom
from django.conf import settings
from django.urls import reverse
from pyxform.errors import PyXFormError
from rest_framework import status

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import (
    TestAbstractViewSet,
)
from kobo.apps.openrosa.apps.api.viewsets.xform_viewset import XFormViewSet
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.constants import CAN_VIEW_XFORM
from kobo.apps.openrosa.libs.serializers.xform_serializer import XFormSerializer
from kobo.apps.openrosa.libs.utils.guardian import assign_perm


class TestXFormViewSet(TestAbstractViewSet):

    def setUp(self):
        super().setUp()
        self.view = XFormViewSet.as_view({
            'get': 'list',
        })

    def test_form_list(self):
        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_form_list_anon(self):
        self.publish_xls_form()
        request = self.factory.get('/')
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_form_list_other_user_access(self):
        """
        Test that a different user has no access to bob's form
        """
        self.publish_xls_form()

        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [self.form_data])

        # test with different user
        previous_user = self.user
        alice_data = {'username': 'alice', 'email': 'alice@localhost.com'}
        self._login_user_and_profile(extra_post_data=alice_data)
        self.assertEqual(self.user.username, 'alice')
        self.assertNotEqual(previous_user, self.user)
        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # should be empty
        self.assertEqual(response.data, [])

    def test_form_list_with_pending_delete_xform(self):
        """
        Test that bob (or anyone else) does not have access to bob's pending
        delete XForm.
        """
        self.publish_xls_form()

        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [self.form_data])

        self.xform.pending_delete = True
        self.xform.save(update_fields=['pending_delete'])

        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_form_list_filter_by_user(self):
        # publish bob's form
        self.publish_xls_form()

        previous_user = self.user
        alice_data = {'username': 'alice', 'email': 'alice@localhost.com'}
        self._login_user_and_profile(extra_post_data=alice_data)
        self.assertEqual(self.user.username, 'alice')
        self.assertNotEqual(previous_user, self.user)

        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)
        view = XFormViewSet.as_view({
            'get': 'retrieve'
        })
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=self.xform.pk)
        bobs_form_data = response.data

        # publish alice's form
        self.publish_xls_form()

        request = self.factory.get('/', **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # should be both bob's and alice's form

        sorted_response_data = sorted(response.data, key=lambda x: x['formid'])
        self.assertEqual(sorted_response_data,
                         [bobs_form_data, self.form_data])

        # apply filter, see only bob's forms
        request = self.factory.get('/', data={'owner': 'bob'}, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [bobs_form_data])

        # apply filter, see only alice's forms
        request = self.factory.get('/', data={'owner': 'alice'}, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [self.form_data])

        # apply filter, see a non existent user
        request = self.factory.get('/', data={'owner': 'noone'}, **self.extra)
        response = self.view(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_form_get(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({
            'get': 'retrieve'
        })
        formid = self.xform.pk
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.form_data)

    def test_form_format(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({
            'get': 'form'
        })
        formid = self.xform.pk
        data = {
            'name': 'transportation_2011_07_25',  # Since commit 3c0e17d0b6041ae96b06c3ef4d2f78a2d0739cbc  # noqa: E501
            'title': 'transportation_2011_07_25',
            'default_language': 'default',
            'id_string': 'transportation_2011_07_25',
            'type': 'survey',
        }
        request = self.factory.get('/', **self.extra)
        # test for unsupported format
        response = view(request, pk=formid, format='xlsx')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # test for supported formats
        response = view(request, pk=formid, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(dict(response.data, **data),
                         response.data)
        response = view(request, pk=formid, format='xml')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_doc = minidom.parseString(response.data)
        response = view(request, pk=formid, format='xls')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        xml_path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.xml',
        )
        with open(xml_path) as xml_file:
            expected_doc = minidom.parse(xml_file)

        model_node = [
            n
            for n in response_doc.getElementsByTagName('h:head')[0].childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'model'
        ][0]

        # check for UUID and remove
        uuid_nodes = [
            node
            for node in model_node.childNodes
            if node.nodeType == Node.ELEMENT_NODE
            and node.getAttribute('nodeset')
            == '/transportation_2011_07_25/formhub/uuid'
        ]
        self.assertEqual(len(uuid_nodes), 1)
        uuid_node = uuid_nodes[0]
        uuid_node.setAttribute('calculate', "''")

        # check content without UUID
        self.assertEqual(response_doc.toxml(), expected_doc.toxml())

    def test_form_tags(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({
            'get': 'labels',
            'post': 'labels',
            'delete': 'labels'
        })
        list_view = XFormViewSet.as_view({
            'get': 'list',
        })
        formid = self.xform.pk

        # no tags
        request = self.factory.get('/', **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.data, [])

        # add tag "hello"
        request = self.factory.post('/', data={'tags': 'hello'}, **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data, ['hello'])

        # check filter by tag
        request = self.factory.get('/', data={'tags': 'hello'}, **self.extra)
        self.form_data = XFormSerializer(
            self.xform, context={'request': request}).data
        response = list_view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [self.form_data])

        request = self.factory.get('/', data={'tags': 'goodbye'}, **self.extra)
        response = list_view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        # remove tag "hello"
        request = self.factory.delete('/', data={'tags': 'hello'}, **self.extra)
        response = view(request, pk=formid, label='hello')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_cannot_publish_xlsform_with_user_account(self):
        response = self.publish_xls_form(use_api=True, assert_creation=False)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_cannot_partial_update_with_user_account(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({
            'patch': 'partial_update'
        })
        title = 'مرحب'
        description = 'DESCRIPTION'
        data = {
            'public': True,
            'description': description,
            'title': title,
            'downloadable': True,
        }
        self.assertFalse(self.xform.shared)

        request = self.factory.patch('/', data=data, **self.extra)
        response = view(request, pk=self.xform.id)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_cannot_form_delete_with_user_account(self):
        self.publish_xls_form()
        self.xform.save()
        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.pk})
        response = self.client.delete(xform_detail_url, **self.extra)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_xform_serializer_none(self):
        data = {
            'title': '',
            'public': False,
            'public_data': False,
            'require_auth': False,
            'description': '',
            'downloadable': False,
            'uuid': '',
            'instances_with_geopoints': False,
            'num_of_submissions': 0,
            'attachment_storage_bytes': 0,
            'kpi_asset_uid': '',
            'mongo_uuid': '',
        }
        self.assertEqual(data, XFormSerializer(None).data)

    def test_cannot_publish_id_string_starting_with_number(self):
        data = {
            'owner': self.user.username,
            'public': False,
            'public_data': False,
            'description': '2011_07_25_transportation',
            'downloadable': True,
            'encrypted': False,
            'id_string': '2011_07_25_transportation',
            'title': '2011_07_25_transportation',
        }

        xls_path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.id_starts_with_num.xls',
        )
        count = XForm.objects.count()
        with pytest.raises(PyXFormError) as e:
            self.publish_xls_form(xls_path, data)
            assert 'Names must begin with a letter' in str(e)

        self.assertEqual(XForm.objects.count(), count)
