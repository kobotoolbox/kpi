import copy

from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
from kpi.constants import PERM_VIEW_SUBMISSIONS

PENDING = {
    '_versions': [
        {
            '_data': {'language': 'en', 'value': 'hello world', 'status': 'complete'},
            '_uuid': '22222222-2222-2222-2222-222222222222',
            '_dateCreated': '2026-11-04T09:45:51.039334Z',
        },
        {
            '_data': {'language': 'en', 'status': 'in_progress'},
            '_uuid': '11111111-1111-1111-1111-111111111111',
            '_dateCreated': '2026-11-04T09:45:24.187768Z',
        },
    ],
    '_dateCreated': '2026-11-04T09:45:24.187768Z',
    '_dateModified': '2026-11-04T09:45:51.039334Z',
}


class SupplementImportAPITestCase(SubsequenceBaseTestCase):

    def setUp(self):
        super().setUp()
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )
        self.import_url = reverse(
            self._get_endpoint('submission-supplement-import'),
            args=[self.asset.uid, self.submission_uuid],
        )
        self.payload = {
            '_version': '20250820',
            'q1': {'automatic_google_transcription': copy.deepcopy(PENDING)},
        }

    def stored(self):
        return SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content

    def test_import_keeps_versions_as_they_are(self):
        response = self.client.post(self.import_url, data=self.payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['added'] == 2
        node = self.stored()['q1']['automatic_google_transcription']
        assert node == PENDING
        # Still pending review: not accepted on import
        assert '_dateAccepted' not in node['_versions'][0]
        assert response.data['supplement']['q1'] == self.payload['q1']

    def test_import_again_changes_nothing(self):
        self.client.post(self.import_url, data=self.payload, format='json')
        response = self.client.post(self.import_url, data=self.payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {**response.data, 'added': 0, 'updated': 0}
        assert len(self.stored()['q1']['automatic_google_transcription']['_versions']) == 2

    def test_acceptance_follows_and_is_never_undone(self):
        self.client.post(self.import_url, data=self.payload, format='json')
        accepted = copy.deepcopy(self.payload)
        version = accepted['q1']['automatic_google_transcription']['_versions'][0]
        version['_dateAccepted'] = '2026-11-04T10:00:00Z'
        response = self.client.post(self.import_url, data=accepted, format='json')
        assert response.data['updated'] == 1
        # An import without it (an older copy) keeps the acceptance
        self.client.post(self.import_url, data=self.payload, format='json')
        stored = self.stored()['q1']['automatic_google_transcription']['_versions'][0]
        assert stored['_dateAccepted'] == '2026-11-04T10:00:00Z'

    def test_versions_from_two_sources_are_merged_newest_first(self):
        self.client.post(self.import_url, data=self.payload, format='json')
        other = copy.deepcopy(self.payload)
        other['q1']['automatic_google_transcription'] = {
            '_versions': [
                {
                    '_data': {'language': 'en', 'value': 'hello', 'status': 'complete'},
                    '_uuid': '33333333-3333-3333-3333-333333333333',
                    '_dateCreated': '2026-11-05T08:00:00Z',
                }
            ],
            '_dateCreated': '2026-11-05T08:00:00Z',
            '_dateModified': '2026-11-05T08:00:00Z',
        }
        response = self.client.post(self.import_url, data=other, format='json')
        assert response.data['added'] == 1
        node = self.stored()['q1']['automatic_google_transcription']
        assert [v['_uuid'][0] for v in node['_versions']] == ['3', '2', '1']
        assert node['_dateCreated'] == PENDING['_dateCreated']
        assert node['_dateModified'] == '2026-11-05T08:00:00Z'

    def test_action_not_enabled_is_refused(self):
        payload = copy.deepcopy(self.payload)
        payload['q1']['manual_transcription'] = copy.deepcopy(PENDING)
        response = self.client.post(self.import_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['missing'] == ['q1/manual_transcription']
        assert not SubmissionSupplement.objects.filter(asset=self.asset).exists()

    def test_invalid_version_is_refused(self):
        payload = copy.deepcopy(self.payload)
        # complete without a value fails the action's result schema
        del payload['q1']['automatic_google_transcription']['_versions'][0]['_data']['value']
        response = self.client.post(self.import_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        content = SubmissionSupplement.objects.filter(asset=self.asset).first()
        assert content is None or 'q1' not in content.content

    def test_unknown_language_is_refused(self):
        payload = copy.deepcopy(self.payload)
        versions = payload['q1']['automatic_google_transcription']['_versions']
        versions[1]['_data']['language'] = 'xx'
        response = self.client.post(self.import_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_old_schema_version_is_refused(self):
        payload = {**self.payload, '_version': '20240101'}
        response = self.client.post(self.import_url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_view_only_user_cannot_import(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(anotheruser, PERM_VIEW_SUBMISSIONS)
        self.client.force_login(anotheruser)
        response = self.client.post(self.import_url, data=self.payload, format='json')
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )

    def test_get_is_not_allowed(self):
        # kobo-transfer tells servers with the route (405) from those without (404)
        response = self.client.get(self.import_url)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
