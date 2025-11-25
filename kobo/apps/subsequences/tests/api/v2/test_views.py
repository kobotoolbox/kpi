import json

from django.test import Client
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.models import QuestionAdvancedFeature
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
            kwargs={'parent_lookup_asset': self.asset.uid},
        )
        self.action_detail_url = reverse(
            'api_v2:advanced-features-detail',
            kwargs={'parent_lookup_asset': self.asset.uid, 'pk': self.action.uid},
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
