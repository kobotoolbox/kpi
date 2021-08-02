# coding: utf-8
import json
import unittest

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.urls import reverse
from formpack.utils.expand_content import SCHEMA_VERSION
from lxml import etree
from private_storage.storage.files import PrivateFileSystemStorage
from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.models import Asset
from kpi.models import ExportTask
from kpi.serializers.v1.asset import AssetListSerializer
# importing module instead of the class, avoid running the tests twice
from kpi.tests.api.v2 import test_api_assets
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.kpi_test_case import KpiTestCase

EMPTY_SURVEY = {'survey': [], 'schema': SCHEMA_VERSION, 'settings': {}}


class AssetListApiTests(test_api_assets.AssetListApiTests):
    URL_NAMESPACE = None

    def test_asset_list_matches_detail(self):
        detail_response = self.create_asset()
        list_response = self.client.get(self.list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK,
                         msg=list_response.data)
        expected_list_data = {
            field: detail_response.data[field]
            for field in AssetListSerializer.Meta.fields
        }
        list_result_detail = None
        for result in list_response.data['results']:
            if result['uid'] == expected_list_data['uid']:
                list_result_detail = result
                break
        self.assertIsNotNone(list_result_detail)
        self.assertDictEqual(expected_list_data, dict(list_result_detail))


class AssetVersionApiTests(test_api_assets.AssetVersionApiTests):
    URL_NAMESPACE = None


class AssetDetailApiTests(test_api_assets.AssetDetailApiTests):
    URL_NAMESPACE = None

    @unittest.skip(reason='`assignable_permissions` property only exists in '
                          'v2 endpoint')
    def test_assignable_permissions(self):
        pass


class AssetsXmlExportApiTests(KpiTestCase):
    fixtures = ['test_data']

    def test_xml_export_title_retained(self):
        asset_title = 'XML Export Test Asset Title'
        content = {'settings': [{'id_string': 'titled_asset'}],
                   'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset = self.create_asset(asset_title, json.dumps(content), format='json')
        response = self.client.get(reverse('asset-detail',
                                           kwargs={'uid': asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml = etree.fromstring(response.content)
        title_elts = xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertEqual(title_elts[0].text, asset_title)

    def test_xml_export_name_as_title(self):
        asset_name = 'XML Export Test Asset Name'
        content = {'settings': [{'form_id': 'named_asset'}],
                   'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset = self.create_asset(asset_name, json.dumps(content), format='json')
        response = self.client.get(reverse('asset-detail',
                                           kwargs={'uid': asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml = etree.fromstring(response.content)
        title_elts = xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertEqual(title_elts[0].text, asset_name)

    def test_api_xml_export_auto_title(self):
        content = {'settings': [{'form_id': 'no_title_asset'}],
                   'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        self.login('someuser', 'someuser')
        asset = self.create_asset('', json.dumps(content), format='json')
        response = self.client.get(reverse('asset-detail',
                                           kwargs={'uid': asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml = etree.fromstring(response.content)
        title_elts = xml.xpath('./*[local-name()="head"]/*[local-name()="title"]')
        self.assertEqual(len(title_elts), 1)
        self.assertNotEqual(title_elts[0].text, '')

    def test_xml_export_group(self):
        example_formbuilder_output = {'survey': [{"type": "begin_group",
                                                  "relevant": "",
                                                  "appearance": "",
                                                  "name": "group_hl3hw45",
                                                  "label": "Group 1 Label"},
                                                 {"required": "true",
                                                  "type": "decimal",
                                                  "label": "Question 1 Label"},
                                                 {"type": "end_group"}],
                                      "settings": [{"form_title": "",
                                                    "form_id": "group_form"}]}

        self.login('someuser', 'someuser')
        asset = self.create_asset('', json.dumps(example_formbuilder_output), format='json')
        response = self.client.get(reverse('asset-detail',
                                           kwargs={'uid': asset.uid, 'format': 'xml'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        xml = etree.fromstring(response.content)
        group_elts = xml.xpath('./*[local-name()="body"]/*[local-name()="group"]')
        self.assertEqual(len(group_elts), 1)
        self.assertNotIn('relevant', group_elts[0].attrib)


class ObjectRelationshipsTests(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.surv = Asset.objects.create(content={'survey': [{"type": "text", "name": "q1"}]},
                                         owner=self.user,
                                         asset_type='survey')
        self.coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='sample collection',
            owner=self.user
        )

    def _count_children_by_kind(self, children, kind):
        count = 0
        # TODO: Request all pages of children
        for child in children['results']:
            if child['kind'] == kind:
                count += 1
        return count

    def test_list_asset(self):
        pass

    def test_collection_can_have_asset(self):
        """
        * after assigning a asset, self.surv, to a collection (self.coll) [via the ORM]
            the asset is now listed in the collection's list of assets.
        """
        _ = self.client.get(reverse('asset-detail', args=[self.surv.uid]))
        coll_req1 = self.client.get(
            reverse("asset-detail", args=[self.coll.uid])
        )
        self.assertEqual(self._count_children_by_kind(
            coll_req1.data['children'], self.surv.kind), 0)

        self.surv.parent = self.coll
        self.surv.save()

        surv_req2 = self.client.get(
            reverse("asset-detail", args=[self.surv.uid])
        )
        self.assertIn("parent", surv_req2.data)
        self.assertIn(self.coll.uid, surv_req2.data["parent"])

        coll_req2 = self.client.get(
            reverse("asset-detail", args=[self.coll.uid])
        )
        self.assertEqual(self._count_children_by_kind(
            coll_req2.data['children'], self.surv.kind), 1)
        self.assertEqual(
            self.surv.uid, coll_req2.data['children']['results'][0]['uid'])

    def test_add_asset_to_collection(self):
        """
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        """
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(
            surv_url,
            data={"parent": reverse("asset-detail", args=[self.coll.uid])},
        )
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/assets/%s' % (self.coll.uid), req.data['parent'])

    def test_remove_asset_from_collection(self):
        """
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        * removing the collection assignment returns a HTTP 200 code.
        * a follow up query on the asset shows the collection unassigned
        """
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(
            surv_url,
            data={"parent": reverse("asset-detail", args=[self.coll.uid])},
        )
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/assets/%s' % (self.coll.uid), req.data['parent'])
        # Assigned asset to collection successfully; now remove it
        patch_req = self.client.patch(surv_url, data={'parent': ''})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIsNone(req.data['parent'])

    def test_move_asset_between_collections(self):
        """
        * a survey starts out with no collection.
        * assigning a collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows that the collection is now set
        * assigning a new collection to the survey returns a HTTP 200 code.
        * a follow up query on the asset shows the new collection now set
        """
        self.assertEqual(self.surv.parent, None)
        surv_url = reverse('asset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(surv_url, data={'parent': reverse(
            'asset-detail', args=[self.coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/assets/%s' % (self.coll.uid), req.data['parent'])
        # Assigned asset to collection successfully; now move it to another
        other_coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='another collection',
            owner=self.user
        )
        patch_req = self.client.patch(surv_url, data={'parent': reverse(
            'asset-detail', args=[other_coll.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        self.assertIn('/assets/%s' % (other_coll.uid), req.data['parent'])


class AssetSettingsFieldTest(test_api_assets.AssetSettingsFieldTest):
    URL_NAMESPACE = None


class AssetExportTaskTest(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(
            content={'survey': [{"type": "text", "name": "q1"}]},
            owner=self.user,
            asset_type='survey',
            name='тєѕт αѕѕєт'
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        v_uid = self.asset.latest_deployed_version.uid
        submission = {
            '__version__': v_uid,
            'q1': '¿Qué tal?'
        }
        self.asset.deployment.mock_submissions([submission])

    def test_owner_can_create_export(self):
        post_url = reverse('exporttask-list')
        asset_url = reverse('asset-detail', args=[self.asset.uid])
        task_data = {
            'source': asset_url,
            'type': 'csv',
        }
        # Create the export task
        response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        detail_response = self.client.get(response.data['url'])
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], 'complete')
        self.assertEqual(detail_response.data['messages'], {})
        # Get the result file
        result_response = self.client.get(detail_response.data['result'])
        result_content = result_response.getvalue().decode('utf-8')
        self.assertEqual(result_response.status_code, status.HTTP_200_OK)
        expected_content = ''.join([
            '"q1";"_id";"_uuid";"_submission_time";"_validation_status";"_notes";"_status";"_submitted_by";"_tags";"_index"\r\n',
            '"¿Qué tal?";"1";"";"";"";"";"";"";"";"1"\r\n',
        ])

        self.assertEqual(result_content, expected_content)
        return detail_response

    def test_other_user_cannot_access_export(self):
        detail_response = self.test_owner_can_create_export()
        self.client.logout()
        self.client.login(username='otheruser', password='otheruser')
        response = self.client.get(detail_response.data['url'])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.get(detail_response.data['result'])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anon_cannot_access_export(self):
        detail_response = self.test_owner_can_create_export()
        self.client.logout()
        response = self.client.get(detail_response.data['url'])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.get(detail_response.data['result'])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_with_token_auth_can_access_export(self):
        detail_response = self.test_owner_can_create_export()
        self.client.logout()
        self.client.credentials(
            HTTP_AUTHORIZATION='Token {}'.format(
                Token.objects.get_or_create(user=self.user)[0].key
            )
        )
        response = self.client.get(detail_response.data['url'])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Get the result file
        result_response = self.client.get(detail_response.data['result'])
        self.assertEqual(result_response.status_code, status.HTTP_200_OK)

    def test_owner_can_create_and_delete_export(self):
        detail_response = self.test_owner_can_create_export()
        result_response = self.client.get(detail_response.data['result'])
        file_name = str(result_response._closable_objects[0].name)

        detail_url = reverse('exporttask-detail', kwargs={
            'uid': detail_response.data['uid']
            })

        # checking if file exists before attempting to delete
        file_exists_before_delete = ExportTask.result.field.storage.exists(
            name=file_name
        )
        assert file_exists_before_delete

        # deleting the export
        delete_response = self.client.delete(detail_url)
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

        # checking if file still exists after attempting to delete it
        file_exists_after_delete = ExportTask.result.field.storage.exists(
            name=file_name
        )
        assert not file_exists_after_delete


class AssetFileTest(test_api_assets.AssetFileTest):
    URL_NAMESPACE = None
