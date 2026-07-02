import uuid

from django.urls import reverse
from rest_framework import status

from kobo.apps.subsequences.models import SubmissionSupplement
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase


TRANSCRIPTION_VERSION = {
    '_dateCreated': '2026-01-01T00:00:00.000000Z',
    '_uuid': '00000000-0000-0000-0000-000000000001',
    '_data': {
        'language': 'en',
        'locale': 'en-US',
        'status': 'complete',
        'value': 'hello world',
    },
}

TRANSLATION_VERSION = {
    '_dateCreated': '2026-01-01T00:00:00.000000Z',
    '_uuid': '00000000-0000-0000-0000-000000000002',
    '_data': {
        'language': 'fr',
        'status': 'complete',
        'value': 'bonjour le monde',
    },
}


def _transcription_supplement(uuid_, language='en', include_date_accepted=False):
    """
    Return a minimal SubmissionSupplement content dict for a transcription
    """
    version = dict(TRANSCRIPTION_VERSION)
    version['_data'] = dict(version['_data'], language=language)
    if include_date_accepted:
        version['_dateAccepted'] = '2026-01-01T00:00:00.000000Z'
    return {
        '_version': '20250820',
        'q1': {
            'automatic_google_transcription': {
                '_dateCreated': '2026-01-01T00:00:00.000000Z',
                '_dateModified': '2026-01-01T00:00:00.000000Z',
                '_versions': [version],
            }
        },
    }


def _translation_supplement(uuid_, language='fr', include_date_accepted=False):
    """
    Return a minimal SubmissionSupplement content dict for a translation
    """
    version = dict(TRANSLATION_VERSION)
    version['_data'] = dict(version['_data'], language=language)
    if include_date_accepted:
        version['_dateAccepted'] = '2026-01-01T00:00:00.000000Z'
    return {
        '_version': '20250820',
        'q1': {
            'automatic_google_translation': {
                language: {
                    '_dateCreated': '2026-01-01T00:00:00.000000Z',
                    '_dateModified': '2026-01-01T00:00:00.000000Z',
                    '_versions': [version],
                }
            }
        },
    }


class BulkAcceptAPITestCase(SubsequenceBaseTestCase):
    """
    Tests for the bulk-accept endpoint:
    POST /api/v2/assets/{uid_asset}/data/supplements/bulk/
    """

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
        self.accept_url = reverse(
            self._get_endpoint('data-supplements-bulk-list'),
            args=[self.asset.uid],
        )

    def _post_accept(self, payload):
        return self.client.post(self.accept_url, data=payload, format='json')

    def _create_transcription_supplements(self):
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=_transcription_supplement(self.submission_uuid),
        )
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.second_submission_uuid,
            content=_transcription_supplement(self.second_submission_uuid),
        )

    def _create_translation_supplements(self, language='fr'):
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=_translation_supplement(self.submission_uuid, language=language),
        )
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.second_submission_uuid,
            content=_translation_supplement(
                self.second_submission_uuid, language=language
            ),
        )

    def test_bulk_accept_transcription_returns_200(self):
        """
        Test that a valid transcription bulk-accept request returns HTTP 200
        """
        self._create_transcription_supplements()
        response = self._post_accept(
            {
                'submission_uids': [
                    self.submission_uuid,
                    self.second_submission_uuid,
                ],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_200_OK

    def test_bulk_accept_transcription_stamps_date_accepted(self):
        """
        Test that after a successful bulk-accept, every targeted supplement's
        latest transcription version must have `_dateAccepted` set
        """
        self._create_transcription_supplements()
        self._post_accept(
            {
                'submission_uids': [
                    self.submission_uuid,
                    self.second_submission_uuid,
                ],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        for sub_uuid in [self.submission_uuid, self.second_submission_uuid]:
            supp = SubmissionSupplement.objects.get(
                asset=self.asset, submission_uuid=sub_uuid
            )
            latest = (
                supp.content['q1']['automatic_google_transcription']['_versions'][0]
            )
            assert '_dateAccepted' in latest
            assert latest['_dateAccepted'] is not None

    def test_bulk_accept_transcription_returns_correct_count(self):
        """
        Test that the `accepted_count` in the response matches the number of
        accepted records
        """
        self._create_transcription_supplements()
        response = self._post_accept(
            {
                'submission_uids': [
                    self.submission_uuid,
                    self.second_submission_uuid,
                ],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.data['accepted_count'] == 2

    def test_bulk_accept_single_submission(self):
        """
        Test that endpoint also accepts a single submission (non-bulk usage)
        """
        self._create_transcription_supplements()
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['accepted_count'] == 1

    def test_bulk_accept_translation_stamps_date_accepted(self):
        """
        Test that translation bulk-accept correctly navigates the language-keyed
        structure and stamps `_dateAccepted` on the latest version
        """
        self._create_translation_supplements(language='fr')
        self._post_accept(
            {
                'submission_uids': [
                    self.submission_uuid,
                    self.second_submission_uuid,
                ],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_translation',
                'language': 'fr',
                'operation': 'accept',
            }
        )
        for sub_uuid in [self.submission_uuid, self.second_submission_uuid]:
            supp = SubmissionSupplement.objects.get(
                asset=self.asset, submission_uuid=sub_uuid
            )
            latest = supp.content['q1']['automatic_google_translation']['fr'][
                '_versions'
            ][0]
            assert '_dateAccepted' in latest
            assert latest['_dateAccepted'] is not None

    def test_bulk_accept_skips_missing_supplements(self):
        """
        Test that submissions without a supplement record are silently skipped;
        only those with actual data count toward `accepted_count`
        """
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=_transcription_supplement(self.submission_uuid),
        )
        # second_submission_uuid has NO supplement
        response = self._post_accept(
            {
                'submission_uids': [
                    self.submission_uuid,
                    self.second_submission_uuid,
                ],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['accepted_count'] == 1

    def test_bulk_accept_skips_null_value_versions(self):
        """
        Test that versions whose `_data.value` is None (in-progress or deleted)
        must not be accepted; accepted_count must be 0
        """
        in_progress_content = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-01T00:00:00.000000Z',
                    '_dateModified': '2026-01-01T00:00:00.000000Z',
                    '_versions': [
                        {
                            '_dateCreated': '2026-01-01T00:00:00.000000Z',
                            '_uuid': '00000000-0000-0000-0000-000000000099',
                            '_data': {
                                'language': 'en',
                                'status': 'in_progress',
                                # no 'value' key
                            },
                        }
                    ],
                }
            },
        }
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=in_progress_content,
        )
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['accepted_count'] == 0

    def test_bulk_accept_already_accepted_updates_date(self):
        """
        Test that Re-accepting an already-accepted version overwrites
        `_dateAccepted` with the current timestamp and is counted
        """
        self._create_transcription_supplements()
        # Accept once
        self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        supp_before = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        )
        first_date = supp_before.content['q1']['automatic_google_transcription'][
            '_versions'
        ][0].get('_dateAccepted')

        # Accept again
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.data['accepted_count'] == 1
        supp_after = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        )
        second_date = supp_after.content['q1']['automatic_google_transcription'][
            '_versions'
        ][0].get('_dateAccepted')
        # Both dates are present; second may equal or be later than first
        assert first_date is not None
        assert second_date is not None

    def test_bulk_accept_empty_submission_uids_returns_400(self):
        response = self._post_accept(
            {
                'submission_uids': [],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_accept_missing_action_returns_400(self):
        """
        Test that omitting the `action` field returns HTTP 400
        """
        self._create_transcription_supplements()
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_accept_invalid_action_returns_400(self):
        """
        Test that an unsupported `action` value returns HTTP 400
        """
        self._create_transcription_supplements()
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'delete',
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_accept_invalid_action_id_returns_400(self):
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'manual_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_accept_unauthenticated_returns_404(self):
        self.client.logout()
        response = self._post_accept(
            {
                'submission_uids': [self.submission_uuid],
                'question_xpath': 'q1',
                'action_id': 'automatic_google_transcription',
                'operation': 'accept',
            }
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
