import uuid

from django.urls import reverse
from rest_framework import status

from kobo.apps.subsequences.models import (
    BulkActionItemStatus,
    BulkActionStatus,
    SubmissionSupplement,
    SubsequenceBulkAction,
)
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase


class BulkActionAPITestCase(SubsequenceBaseTestCase):
    def setUp(self):
        super().setUp()
        self.second_submission_uuid = str(uuid.uuid4())
        self.asset.deployment.mock_submissions(
            [
                {
                    'q1': 'answer 2',
                    '_uuid': self.second_submission_uuid,
                    '_submitted_by': 'someuser',
                },
            ]
        )
        self.list_url = reverse(
            self._get_endpoint('advanced-features-bulk-actions-list'),
            args=[self.asset.uid],
        )

    def _build_payload(self, **overrides):
        payload = {
            'action_id': 'automatic_google_transcription',
            'question_xpath': 'q1',
            'submission_uuids': [
                self.submission_uuid,
                self.second_submission_uuid,
            ],
            'params': {
                'language': 'en',
                'locale': 'en-US',
            },
        }
        payload.update(overrides)
        return payload

    def _get_detail_url(self, action_uid):
        return reverse(
            self._get_endpoint('advanced-features-bulk-actions-detail'),
            args=[self.asset.uid, action_uid],
        )

    def _make_transcription_supplement(self, *, language='en', locale='en-US'):
        return {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    '_dateCreated': '2026-05-14T10:00:00Z',
                    '_dateModified': '2026-05-14T10:00:00Z',
                    '_versions': [
                        {
                            '_dateCreated': '2026-05-14T10:00:00Z',
                            '_dateAccepted': '2026-05-14T10:00:00Z',
                            '_uuid': '11111111-1111-1111-1111-111111111111',
                            '_data': {
                                'language': language,
                                'locale': locale,
                                'status': 'complete',
                                'value': 'hello world',
                            },
                        }
                    ],
                }
            },
        }

    def test_create_bulk_action(self):
        response = self.client.post(
            self.list_url,
            data=self._build_payload(),
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        action = SubsequenceBulkAction.objects.get(uid=response.data['uid'])
        assert action.asset == self.asset
        assert action.status == BulkActionStatus.PENDING
        assert action.created_by == 'someuser'
        assert response.data['action_id'] == 'automatic_google_transcription'
        assert response.data['question_xpath'] == 'q1'
        assert set(response.data['submission_uuids']) == {
            self.submission_uuid,
            self.second_submission_uuid,
        }
        assert {
            (item['uuid'], item['status'])
            for item in response.data['submission_statuses']
        } == {
            (self.submission_uuid, BulkActionItemStatus.PENDING),
            (self.second_submission_uuid, BulkActionItemStatus.PENDING),
        }
        assert response.data['params'] == {'language': 'en', 'locale': 'en-US'}
        assert response.data['created_by'] == {'username': 'someuser'}
        assert response.data['cancelled_by'] is None

    def test_list_bulk_actions_returns_paginated_response(self):
        action = SubsequenceBulkAction.create_with_items(
            asset=self.asset,
            action_id='automatic_google_transcription',
            question_xpath='q1',
            params={'language': 'en', 'locale': 'en-US'},
            created_by='someuser',
            submission_root_uuids=[
                self.submission_uuid,
                self.second_submission_uuid,
            ],
        )

        response = self.client.get(self.list_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['uid'] == action.uid
        assert set(response.data['results'][0]['submission_uuids']) == {
            self.submission_uuid,
            self.second_submission_uuid,
        }

    def test_retrieve_bulk_action(self):
        action = SubsequenceBulkAction.create_with_items(
            asset=self.asset,
            action_id='automatic_google_transcription',
            question_xpath='q1',
            params={'language': 'en', 'locale': 'en-US'},
            created_by='someuser',
            submission_root_uuids=[
                self.submission_uuid,
                self.second_submission_uuid,
            ],
        )

        response = self.client.get(self._get_detail_url(action.uid))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['uid'] == action.uid
        assert response.data['status'] == BulkActionStatus.PENDING
        assert {
            (item['uuid'], item['status'])
            for item in response.data['submission_statuses']
        } == {
            (self.submission_uuid, BulkActionItemStatus.PENDING),
            (self.second_submission_uuid, BulkActionItemStatus.PENDING),
        }

    def test_create_bulk_action_rejects_unknown_submissions(self):
        response = self.client.post(
            self.list_url,
            data=self._build_payload(
                submission_uuids=[self.submission_uuid, 'missing-uuid']
            ),
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Unknown submission UUIDs: missing-uuid' in str(response.data)
        assert SubsequenceBulkAction.objects.count() == 0

    def test_create_bulk_action_rejects_active_matching_conflicts(self):
        SubsequenceBulkAction.create_with_items(
            asset=self.asset,
            action_id='automatic_google_transcription',
            question_xpath='q1',
            params={'language': 'en', 'locale': 'en-US'},
            created_by='someuser',
            submission_root_uuids=[self.submission_uuid],
        )

        response = self.client.post(
            self.list_url,
            data=self._build_payload(submission_uuids=[self.submission_uuid]),
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'active matching bulk action' in str(response.data)
        assert SubsequenceBulkAction.objects.count() == 1

    def test_create_bulk_action_rejects_existing_transcription(self):
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=self._make_transcription_supplement(),
        )

        response = self.client.post(
            self.list_url,
            data=self._build_payload(submission_uuids=[self.submission_uuid]),
            format='json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already contain matching results' in str(response.data)
        assert self.submission_uuid in str(response.data)
        assert SubsequenceBulkAction.objects.count() == 0
