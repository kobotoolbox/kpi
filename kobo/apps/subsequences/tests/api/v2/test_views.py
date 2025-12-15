import json

from django.test import Client
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kobo.apps.subsequences.tests.constants import OLD_STYLE_ADVANCED_FEATURES
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase


class QuestionAdvancedFeatureViewSetTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        user = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(
            owner=user,
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
        )
        self.action = QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )
        self.list_actions_url = reverse(
            'api_v2:advanced-features-list',
            kwargs={'uid_asset': self.asset.uid},
        )
        self.action_detail_url = reverse(
            'api_v2:advanced-features-detail',
            kwargs={'uid_asset': self.asset.uid, 'pk': self.action.uid},
        )
        self.client = Client(raise_request_exception=False)
        self.client.force_login(user)

    def test_list_advanced_features(self):
        res = self.client.get(self.list_actions_url)
        assert res.status_code == status.HTTP_200_OK
        assert res.json() == [
            {
                'action': 'manual_transcription',
                'question_xpath': 'q1',
                'params': [{'language': 'en'}],
                'uid': self.action.uid,
            }
        ]

    def test_update_feature(self):
        res = self.client.patch(
            self.action_detail_url,
            content_type='application/json',
            data=json.dumps({'params': [{'language': 'es'}]}),
        )
        assert res.status_code == status.HTTP_200_OK
        self.action.refresh_from_db()
        assert self.action.params == [{'language': 'en'}, {'language': 'es'}]

    def test_cannot_update_feature_with_invalid_params(self):
        res = self.client.patch(
            self.action_detail_url,
            content_type='application/json',
            data=json.dumps({'params': [{'bad': 'stuff'}]}),
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        self.action.refresh_from_db()
        assert self.action.params == [{'language': 'en'}]

    def test_create_feature(self):
        res = self.client.post(
            self.list_actions_url,
            data={
                'action': 'manual_translation',
                'params': json.dumps([{'language': 'de'}]),
                'question_xpath': 'q1',
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        new_action = QuestionAdvancedFeature.objects.get(
            asset=self.asset, action='manual_translation'
        )
        assert new_action.params == [{'language': 'de'}]
        assert new_action.question_xpath == 'q1'

    def test_cannot_delete_features(self):
        res = self.client.delete(self.action_detail_url)
        assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
        assert QuestionAdvancedFeature.objects.filter(
            asset=self.asset, action=self.action.action
        ).exists()

    def test_list_advanced_features_migrates_if_necessary(self):
        QuestionAdvancedFeature.objects.all().delete()
        Asset.objects.filter(pk=self.asset.pk).update(
            advanced_features=OLD_STYLE_ADVANCED_FEATURES
        )
        self.asset.refresh_from_db()
        assert self.asset.advanced_features.get('_version') is None
        self.client.get(self.list_actions_url)
        self.asset.refresh_from_db()
        # what's actually created is tested elsewhere, just check that we migrated
        assert self.asset.advanced_features.get('_version') == '20250820'

    def test_create_advanced_features_fails_if_feature_exists_in_old_field(self):
        QuestionAdvancedFeature.objects.all().delete()
        Asset.objects.filter(pk=self.asset.pk).update(
            advanced_features=OLD_STYLE_ADVANCED_FEATURES,
            known_cols=['q1:transcription:en', 'q2:translation:es'],
        )
        self.asset.refresh_from_db()
        assert not self.asset.advanced_features_set.exists()
        # manual translation for this question already exists in the old dict,
        # we shouldn't be able to re-create it
        res = self.client.post(
            self.list_actions_url,
            data={
                'action': 'manual_translation',
                'params': json.dumps([{'language': 'de'}]),
                'question_xpath': 'q1',
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_advanced_features_migrates_if_necessary(self):
        QuestionAdvancedFeature.objects.all().delete()
        Asset.objects.filter(pk=self.asset.pk).update(
            advanced_features=OLD_STYLE_ADVANCED_FEATURES,
            known_cols=['q1:transcription:en', 'q2:translation:es'],
        )
        self.asset.refresh_from_db()
        assert self.asset.advanced_features.get('_version') is None

        res = self.client.post(
            self.list_actions_url,
            data={
                'action': 'manual_translation',
                'params': json.dumps([{'language': 'de'}]),
                'question_xpath': 'new_question',
            },
        )
        self.asset.refresh_from_db()
        assert self.asset.advanced_features.get('_version') == '20250820'
        assert res.status_code == status.HTTP_201_CREATED

    def test_cannot_create_feature_with_invalid_params(self):
        res = self.client.post(
            self.list_actions_url,
            data={
                'action': 'manual_translation',
                'params': json.dumps([{'bad': 'stuff'}]),
                'question_xpath': 'q1',
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
