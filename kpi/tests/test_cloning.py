# coding: utf-8

import json
import unittest

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import ASSET_TYPE_ARG_NAME, ASSET_TYPE_SURVEY, \
    ASSET_TYPE_TEMPLATE, ASSET_TYPE_BLOCK, ASSET_TYPE_QUESTION
from kpi.exceptions import BadAssetTypeException
from .kpi_test_case import KpiTestCase
from .test_assets import AssetsTestCase


class TestCloningOrm(AssetsTestCase):
    def test_clone_asset_version(self):
        self.asset.content['survey'][0]['type'] = 'integer'
        self.asset.name = 'Version 2'
        self.asset.save()
        v2_uid = self.asset.asset_versions.first().uid

        self.asset.content['survey'][0]['type'] = 'note'
        self.asset.name = 'Version 3'
        self.asset.save()
        v3_uid = self.asset.asset_versions.first().uid

        v3_clone_data = self.asset.to_clone_dict(version=v3_uid)
        v2_clone_data = self.asset.to_clone_dict(version=v2_uid)

        self.assertEqual(v2_clone_data['name'], 'Version 2')
        self.assertEqual(v2_clone_data['content']['survey'][0]['type'], 'integer')

        self.assertEqual(v3_clone_data['name'], 'Version 3')
        self.assertEqual(v3_clone_data['content']['survey'][0]['type'], 'note')

    def test_clone_asset_without_version(self):
        """
        This test is pretty basic. It just validates that a version is created
        when asset is cloned if it does not have any
        """
        self.asset.asset_versions.all().delete()
        asset_versions_count = self.asset.asset_versions.count()
        assert asset_versions_count == 0
        cloned_dict = self.asset.to_clone_dict()
        expected = {
            'name': self.asset.name,
            'content': self.asset.content,
            'asset_type': self.asset.asset_type,
            'tag_string': self.asset.tag_string,
        }
        self.assertEqual(cloned_dict, expected)
        assert asset_versions_count + 1 == self.asset.asset_versions.count()


class TestCloning(KpiTestCase):

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.someuser_password = 'someuser'
        self.another_user = User.objects.get(username='anotheruser')
        self.another_user_password = 'anotheruser'

    def _clone_asset(self, original_asset, partial_update=False, **kwargs):

        kwargs.update({'clone_from': original_asset.uid})
        status_code = status.HTTP_201_CREATED
        endpoint = reverse("asset-list")
        action = self.client.post

        if partial_update:
            status_code = status.HTTP_200_OK
            uid = kwargs.pop("uid", None)
            action = self.client.patch
            endpoint = reverse("asset-detail", kwargs={"uid": uid})

        expected_status_code = kwargs.pop('expected_status_code',
                                          status_code)
        response = action(endpoint, data=kwargs, format='json')
        self.assertEqual(response.status_code, expected_status_code)

        if expected_status_code != status_code:
            return
        else:
            cloned_asset = self.url_to_obj(response.data['url'])
            for field in {'name', 'content'}:
                self.assertEqual(cloned_asset.__dict__[field],
                                 original_asset.__dict__[field])

            self.assertEqual(cloned_asset.asset_type,
                             kwargs.get(ASSET_TYPE_ARG_NAME, original_asset.asset_type))

            original_asset_tags = set(original_asset.tag_string.split(','))
            cloned_asset_tags = set(cloned_asset.tag_string.split(','))
            self.assertSetEqual(cloned_asset_tags, original_asset_tags)

            return cloned_asset

    def test_clone_asset(self):
        self.login(self.someuser.username, self.someuser_password)
        original_asset = self.create_asset(
            'cloning_asset', tag_string='tag1,tag2')
        self._clone_asset(original_asset)

    def test_clone_asset_into_collection(self):
        self.login(self.someuser.username, self.someuser_password)
        original_asset = self.create_asset('cloning_asset')
        parent_collection = self.create_collection('parent_collection')
        parent_url = reverse(
            'asset-detail', kwargs={'uid': parent_collection.uid})
        cloned_asset = self._clone_asset(
            original_asset, parent=parent_url)
        self.assertEqual(cloned_asset.parent, parent_collection)

    def test_cannot_clone_unshared_asset(self):
        self.login(self.someuser.username, self.someuser_password)
        original_asset = self.create_asset('cloning_asset')
        self.login(self.another_user.username, self.another_user_password)
        self._clone_asset(original_asset, expected_status_code=status.HTTP_404_NOT_FOUND)

    def test_clone_shared_asset(self):
        self.login(self.someuser.username, self.someuser_password)
        original_asset = self.create_asset('cloning_asset')
        self.add_perm(original_asset, self.another_user, 'view')
        self.login(self.another_user.username, self.another_user_password)
        self._clone_asset(original_asset)

    def test_clone_survey_to_template(self):
        self.login(self.someuser.username, self.someuser_password)
        settings = {
            "sector": {
                "value": "Arts, Entertainment, and Recreation",
                "label": "Arts, Entertainment, and Recreation"
            },
            "country": {
                "value": "ALB",
                "label": "Albania"
            },
            "share-metadata": True,
            "description": "This form can be cloned"
        }
        original_asset = self.create_asset(
            'cloning_asset', settings=json.dumps(settings))
        template_asset = self._clone_asset(original_asset, asset_type=ASSET_TYPE_TEMPLATE)

        settings.pop("share-metadata", None)
        self.assertEqual(template_asset.asset_type, ASSET_TYPE_TEMPLATE)
        self.assertEqual(template_asset.settings, settings)

    def test_clone_template_to_survey(self):
        self.login(self.someuser.username, self.someuser_password)
        settings = {
            "sector": {
                "value": "Arts, Entertainment, and Recreation",
                "label": "Arts, Entertainment, and Recreation"
            },
            "country": {
                "value": "ALB",
                "label": "Albania"
            },
            "share-metadata": True,  # A template should not have this property
            "description": "This form can be cloned"
        }
        original_asset = self.create_asset(
            'cloning_template', asset_type=ASSET_TYPE_TEMPLATE, settings=json.dumps(settings))

        self.assertEqual(original_asset.asset_type, ASSET_TYPE_TEMPLATE)

        survey_asset = self._clone_asset(original_asset, asset_type=ASSET_TYPE_SURVEY)

        settings.pop("share-metadata", None)
        self.assertEqual(survey_asset.asset_type, ASSET_TYPE_SURVEY)
        self.assertEqual(survey_asset.settings, settings)

    def test_clone_survey_to_library(self):
        self.login(self.someuser.username, self.someuser_password)
        settings = {
            "sector": {
                "value": "Arts, Entertainment, and Recreation",
                "label": "Arts, Entertainment, and Recreation"
            },
            "country": {
                "value": "ALB",
                "label": "Albania"
            },
            "share-metadata": True,
            "description": "This form can be cloned"
        }
        original_asset = self.create_asset(
            'cloning_template', settings=json.dumps(settings))
        block_asset = self._clone_asset(original_asset, asset_type=ASSET_TYPE_BLOCK)
        self.assertEqual(block_asset.asset_type, ASSET_TYPE_BLOCK)
        self.assertEqual(block_asset.settings, {})

    def test_clone_to_bad_asset_type(self):
        self.login(self.someuser.username, self.someuser_password)
        original_asset = self.create_asset(
            'cloning_template', asset_type=ASSET_TYPE_TEMPLATE)

        def _bad_clone():
            self._clone_asset(original_asset, asset_type=ASSET_TYPE_QUESTION)

        self.assertRaises(BadAssetTypeException, _bad_clone)

    def _create_sample_survey_and_template(self):
        survey_settings = {
            "sector": {
                "value": "Arts, Entertainment, and Recreation",
                "label": "Arts, Entertainment, and Recreation"
            },
            "country": {
                "value": "ALB",
                "label": "Albania"
            },
            "share-metadata": True,
            "description": "This survey will be modified"
        }
        survey_asset = self.create_asset(
            "survey_asset",
            settings=json.dumps(survey_settings),
            asset_type=ASSET_TYPE_SURVEY
        )

        template_settings = {
            "sector": {
                "value": "Public Administration",
                "label": "Public Administration"
            },
            "country": {
                "value": "CAN",
                "label": "Canada"
            },
            "share-metadata": True,
            "description": "A template to be cloned"
        }
        template_asset = self.create_asset(
            'template_asset', 
            settings=json.dumps(template_settings),
            asset_type=ASSET_TYPE_TEMPLATE
        )

        return survey_asset, template_asset


    def test_clone_template_to_existing_asset(self):
        self.login(self.someuser.username, self.someuser_password)
        survey_asset, template_asset = self._create_sample_survey_and_template()

        modified_survey_asset = self._clone_asset(template_asset,
                                                  partial_update=True,
                                                  uid=survey_asset.uid,
                                                  asset_type=survey_asset.asset_type)

        self.assertEqual(survey_asset.content.get("survey"), [])
        self.assertEqual(modified_survey_asset.settings.get("description"), "A template to be cloned")
        self.assertEqual(modified_survey_asset.settings.get("country").get("value"), "CAN")
        self.assertEqual(modified_survey_asset.asset_type, survey_asset.asset_type)


    def test_override_settings_while_cloning_template_to_existing_asset(self):
        self.login(self.someuser.username, self.someuser_password)
        survey_asset, template_asset = self._create_sample_survey_and_template()
        modified_survey_asset = self._clone_asset(
            template_asset,
            partial_update=True,
            uid=survey_asset.uid,
            asset_type=survey_asset.asset_type,
            settings={'description': 'I prefer my own, thank you very much!'},
        )
        self.assertEqual(
            modified_survey_asset.settings['description'],
            'I prefer my own, thank you very much!'
        )
        self.assertEqual(
            modified_survey_asset.settings["country"]["value"], "CAN"
        )


# TODO
#     def test_clone_collection(self):
#         raise NotImplementedError
#         self.login(self.someuser.username, self.someuser_password)
#         original_collection= self.create_collection(
#             'cloning_collection', tag_string='tag1,tag2')
#         response = self.client.post(reverse('collection-list'),
#                                     {'clone_from': original_collection.uid})
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         cloned_collection= self.url_to_obj(response.data['url'])
#         for field in COLLECTION_CLONE_FIELDS:
#             self.assertEqual(cloned_collection.__dict__[field],
#                              original_collection.__dict__[field])
#         original_collection_tags= set(
#             original_collection.tag_string.split(','))
#         cloned_collection_tags= set(cloned_collection.tag_string.split(','))
#         self.assertSetEqual(cloned_collection_tags, original_collection_tags)
#
#     def test_clone_collection_into_collection(self):
#         raise NotImplementedError
#
#     def test_clone_shared_collection(self):
#         raise NotImplementedError
#
#     def test_cannot_clone_unshared_collection(self):
#         raise NotImplementedError

if __name__ == "__main__":
    #import sys;sys.argv = ['', 'Test.testName']
    unittest.main()
