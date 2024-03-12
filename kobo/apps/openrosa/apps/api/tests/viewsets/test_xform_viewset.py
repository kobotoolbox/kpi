# coding: utf-8
import os
import re
from io import StringIO
from xml.dom import Node

from django.conf import settings
from django.urls import reverse
from django.test.client import Client
from defusedxml import minidom
from kobo.apps.openrosa.libs.utils.guardian import assign_perm
from kobo_service_account.utils import get_request_headers
from rest_framework import status

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import \
    TestAbstractViewSet
from kobo.apps.openrosa.apps.api.viewsets.xform_viewset import XFormViewSet
from kobo.apps.openrosa.apps.logger.models import XForm, Instance
from kobo.apps.openrosa.libs.constants import (
    CAN_ADD_SUBMISSIONS,
    CAN_CHANGE_XFORM,
    CAN_VIEW_XFORM
)
from kobo.apps.openrosa.libs.serializers.xform_serializer import XFormSerializer


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
            "name": "transportation_2011_07_25",  # Since commit 3c0e17d0b6041ae96b06c3ef4d2f78a2d0739cbc
            "title": "transportation_2011_07_25",
            "default_language": "default",
            "id_string": "transportation_2011_07_25",
            "type": "survey",
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
            settings.OPENROSA_APP_DIR, "apps", "main", "tests", "fixtures",
            "transportation", "transportation.xml")
        with open(xml_path) as xml_file:
            expected_doc = minidom.parse(xml_file)

        model_node = [
            n for n in
            response_doc.getElementsByTagName("h:head")[0].childNodes
            if n.nodeType == Node.ELEMENT_NODE and
               n.tagName == "model"][0]

        # check for UUID and remove
        uuid_nodes = [
            node for node in model_node.childNodes
            if node.nodeType == Node.ELEMENT_NODE
               and node.getAttribute("nodeset") == "/transportation_2011_07_25/formhub/uuid"]
        self.assertEqual(len(uuid_nodes), 1)
        uuid_node = uuid_nodes[0]
        uuid_node.setAttribute("calculate", "''")

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
        request = self.factory.post('/', data={"tags": "hello"}, **self.extra)
        response = view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data, ['hello'])

        # check filter by tag
        request = self.factory.get('/', data={"tags": "hello"}, **self.extra)
        self.form_data = XFormSerializer(
            self.xform, context={'request': request}).data
        response = list_view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [self.form_data])

        request = self.factory.get('/', data={"tags": "goodbye"}, **self.extra)
        response = list_view(request, pk=formid)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        # remove tag "hello"
        request = self.factory.delete('/', data={"tags": "hello"},
                                      **self.extra)
        response = view(request, pk=formid, label='hello')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_cannot_publish_xlsform_with_user_account(self):
        response = self.publish_xls_form(use_service_account=False, assert_=False)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_publish_xlsform_with_service_account(self):
        self.publish_xls_form(use_service_account=True, assert_=True)

    def test_publish_invalid_xls_form(self):
        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.bad_id.xls',
        )

        client = Client()
        xform_list_url = reverse('xform-list')
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST

        with open(path, 'rb') as xls_file:
            post_data = {'xls_file': xls_file}
            response = client.post(
                xform_list_url, data=post_data, **service_account_meta
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            error_msg = '[row : 5] Question or group with no name.'
            self.assertEqual(response.data.get('text'), error_msg)

    def test_publish_invalid_xls_form_no_choices(self):
        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.no_choices.xls',
        )
        client = Client()
        xform_list_url = reverse('xform-list')
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST

        with open(path, 'rb') as xls_file:
            post_data = {'xls_file': xls_file}
            response = client.post(
                xform_list_url, data=post_data, **service_account_meta
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            error_msg = (
                "There should be a choices sheet in this xlsform. "
                "Please ensure that the choices sheet has the mandatory "
                "columns 'list_name', 'name', and 'label'."
            )
            self.assertEqual(response.data.get('text'), error_msg)

    def test_cannot_partial_update_with_user_account(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({
            'patch': 'partial_update'
        })
        title = 'مرحب'
        description = 'DESCRIPTION'
        data = {'public': True, 'description': description, 'title': title,
                'downloadable': True}

        self.assertFalse(self.xform.shared)

        request = self.factory.patch('/', data=data, **self.extra)
        response = view(request, pk=self.xform.id)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_partial_update_with_service_account(self):
        self.publish_xls_form()
        title = 'مرحب'
        description = 'DESCRIPTION'
        data = {
            'public': True,
            'description': description,
            'title': title,
            'downloadable': True,
        }
        self.assertFalse(self.xform.shared)

        alice_profile_data = {
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
        alice_profile = self._create_user_profile(alice_profile_data)
        self.alice = alice_profile.user

        client = Client()
        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.id})
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.alice.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        response = client.patch(
            xform_detail_url,
            data=data,
            content_type='application/json',
            **service_account_meta
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.xform.refresh_from_db()
        self.assertTrue(self.xform.downloadable)
        self.assertTrue(self.xform.shared)
        self.assertEqual(self.xform.description, description)
        self.assertEqual(response.data['public'], True)
        self.assertEqual(response.data['description'], description)
        self.assertEqual(response.data['title'], title)
        matches = re.findall(r"<h:title>([^<]+)</h:title>", self.xform.xml)
        self.assertTrue(len(matches) > 0)
        self.assertEqual(matches[0], title)

    def test_set_form_private(self):
        key = 'shared'
        self.publish_xls_form()
        self.xform.__setattr__(key, True)
        self.xform.save()
        data = {'public': False}

        self.assertTrue(self.xform.__getattribute__(key))
        client = Client()
        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.id})
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        response = client.patch(
            xform_detail_url,
            data=data,
            content_type='application/json',
            **service_account_meta
        )
        self.xform.refresh_from_db()
        self.assertFalse(self.xform.__getattribute__(key))
        self.assertFalse(response.data['public'])

    def test_set_form_bad_value(self):
        key = 'shared'
        self.publish_xls_form()
        data = {'public': 'String'}

        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.id})
        client = Client()
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        response = client.patch(
            xform_detail_url,
            data=data,
            content_type='application/json',
            **service_account_meta
        )
        self.xform.reload()
        self.assertFalse(self.xform.__getattribute__(key))
        self.assertEqual(
            response.data,
            {'shared': ["'String' value must be either True or False."]},
        )

    def test_set_form_bad_key(self):
        self.publish_xls_form()
        self.xform.save()
        view = XFormViewSet.as_view({
            'patch': 'partial_update'
        })
        data = {'nonExistentField': False}

        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.pk})
        client = Client()
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        response = client.patch(
            xform_detail_url,
            data=data,
            content_type='application/json',
            **service_account_meta
        )
        assert response.status_code == status.HTTP_200_OK
        self.xform.reload()
        self.assertFalse(self.xform.shared)
        self.assertFalse(response.data['public'])

    def test_cannot_form_delete_with_user_account(self):
        self.publish_xls_form()
        self.xform.save()
        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.pk})
        response = self.client.delete(xform_detail_url, **self.extra)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_form_delete(self):
        self.publish_xls_form()
        self.xform.save()
        xform_detail_url = reverse('xform-detail', kwargs={'pk': self.xform.pk})
        client = Client()
        service_account_meta = self.get_meta_from_headers(
            get_request_headers(self.user.username)
        )
        service_account_meta['HTTP_HOST'] = settings.TEST_HTTP_HOST
        response = client.delete(xform_detail_url, **service_account_meta)
        self.assertEqual(response.data, None)
        self.assertEqual(response.status_code, 204)
        with self.assertRaises(XForm.DoesNotExist):
            self.xform.reload()

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
            'has_kpi_hooks': False,
            'kpi_asset_uid': '',
        }
        self.assertEqual(data, XFormSerializer(None).data)

    def test_csv_import(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({'post': 'csv_import'})
        csv_import = open(
            os.path.join(
                settings.OPENROSA_APP_DIR,
                'libs',
                'tests',
                'fixtures',
                'good.csv',
            )
        )
        post_data = {'csv_file': csv_import}
        request = self.factory.post('/', data=post_data, **self.extra)
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('additions'), 9)
        self.assertEqual(response.data.get('updates'), 0)

    def test_csv_import_fail(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({'post': 'csv_import'})
        csv_import = open(os.path.join(settings.OPENROSA_APP_DIR, 'libs',
                                       'tests', 'fixtures', 'bad.csv'))
        post_data = {'csv_file': csv_import}
        request = self.factory.post('/', data=post_data, **self.extra)
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsNotNone(response.data.get('error'))

    def test_csv_import_fail_invalid_field_post(self):
        """
        Test that invalid post returns 400 with the error in json response
        """
        self.publish_xls_form()
        view = XFormViewSet.as_view({'post': 'csv_import'})
        csv_import = open(os.path.join(settings.OPENROSA_APP_DIR, 'libs',
                                       'tests', 'fixtures', 'bad.csv'))
        post_data = {'wrong_file_field': csv_import}
        request = self.factory.post('/', data=post_data, **self.extra)
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsNotNone(response.data.get('error'))

    def test_csv_import_fail_anonymous(self):
        self.publish_xls_form()
        view = XFormViewSet.as_view({'post': 'csv_import'})
        csv_import = open(os.path.join(settings.OPENROSA_APP_DIR, 'libs',
                                       'tests', 'fixtures', 'good.csv'))
        post_data = {'csv_file': csv_import}
        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data=post_data
        )
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_csv_import_fail_non_owner(self):
        self.publish_xls_form()
        self._make_submissions()

        # Retain Bob's credentials for later use
        bob_request_extra = self.extra

        # Switch to a privileged but non-owning user
        self._login_user_and_profile(
            extra_post_data={
                'username': 'alice',
                'email': 'alice@localhost.com',
            }
        )
        self.assertEqual(self.user.username, 'alice')
        assign_perm(CAN_VIEW_XFORM, self.user, self.xform)
        assign_perm(CAN_CHANGE_XFORM, self.user, self.xform)
        assign_perm(CAN_ADD_SUBMISSIONS, self.user, self.xform)

        # Surprise: `meta/instanceID` is ignored; `_uuid` is what's examined by
        # the CSV importer to determine whether or not a row updates (edits) an
        # existing submission
        bob_instance = self.xform.instances.first()
        edit_csv_bob = (
            'formhub/uuid,_uuid,transport/available_transportation_types_to_referral_facility\n'
            f'{self.xform.uuid},{bob_instance.uuid},boo!'
        )

        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data={'csv_file': StringIO(edit_csv_bob)},
            **self.extra
        )
        view = XFormViewSet.as_view({'post': 'csv_import'})
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Check that we are sane and that Bob can edit their own submissions
        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data={'csv_file': StringIO(edit_csv_bob)},
            **bob_request_extra
        )
        view = XFormViewSet.as_view({'post': 'csv_import'})
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bob_instance_old_uuid = bob_instance.uuid
        bob_instance.refresh_from_db()
        self.assertEqual(
            bob_instance.json[
                'transport/available_transportation_types_to_referral_facility'
            ],
            'boo!'
        )
        self.assertEqual(
            bob_instance.json[
                'meta/deprecatedID'
            ],
            f'uuid:{bob_instance_old_uuid}'
        )

    def test_csv_import_fail_edit_unauthorized_submission(self):
        view = XFormViewSet.as_view({'post': 'csv_import'})

        # Publish a form as Bob
        self.publish_xls_form()
        self._make_submissions()
        bob_instance = self.xform.instances.first()

        # Publish another form as Alice
        self._login_user_and_profile(
            extra_post_data={
                'username': 'alice',
                'email': 'alice@localhost.com',
            }
        )
        self.assertEqual(self.user.username, 'alice')
        self.publish_xls_form()
        self.assertEqual(self.xform.user.username, 'alice')

        # Make a submission, but not using `self._make_submissions()` because
        # that allows for only one XForm at a time
        new_csv_alice = (
            'formhub/uuid,transport/available_transportation_types_to_referral_facility\n'
            f'{self.xform.uuid},alice unedited'
        )
        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data={'csv_file': StringIO(new_csv_alice)},
            **self.extra
        )
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify that Alice can edit their own submissions
        alice_instance = self.xform.instances.first()
        edit_csv_alice = (
            'formhub/uuid,_uuid,transport/available_transportation_types_to_referral_facility\n'
            f'{self.xform.uuid},{alice_instance.uuid},alice edited'
        )
        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data={'csv_file': StringIO(edit_csv_alice)},
            **self.extra
        )
        response = view(request, pk=self.xform.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        alice_instance.refresh_from_db()
        self.assertEqual(
            alice_instance.json[
                'transport/available_transportation_types_to_referral_facility'
            ],
            'alice edited'
        )

        # Attempt to edit Bob's submission as Alice
        original_bob_xml = bob_instance.xml
        edit_csv_bob = (
            'formhub/uuid,_uuid,transport/available_transportation_types_to_referral_facility\n'
            f'{self.xform.uuid},{bob_instance.uuid},where does this go?!'
        )
        request = self.factory.post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk}),
            data={'csv_file': StringIO(edit_csv_bob)},
            **self.extra
        )
        response = view(request, pk=self.xform.id)

        # The attempted edit should appear as a new submission in Alice's form
        # with the form and instance UUIDs overwritten
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bob_instance.refresh_from_db()
        self.assertEqual(bob_instance.xml, original_bob_xml)
        found_instance = Instance.objects.get(
            xml__contains='where does this go?!'
        )
        self.assertEqual(found_instance.xform, alice_instance.xform)
        self.assertNotEqual(found_instance.xform, bob_instance.xform)
        self.assertNotEqual(found_instance.uuid, bob_instance.uuid)

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

        xls_path = os.path.join(settings.OPENROSA_APP_DIR, 'apps', 'main', 'tests',
                                'fixtures', 'transportation',
                                'transportation.id_starts_with_num.xls')
        count = XForm.objects.count()
        response = self.publish_xls_form(xls_path, data, assert_=False)
        self.assertTrue('Names must begin with a letter' in response.content.decode())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(XForm.objects.count(), count)
