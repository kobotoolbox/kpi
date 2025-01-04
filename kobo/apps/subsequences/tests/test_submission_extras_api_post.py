from copy import deepcopy
from unittest.mock import Mock, patch

from constance.test import override_config
from django.test import override_settings
from django.urls import reverse
from google.cloud import translate_v3
from jsonschema import validate
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.languages.models.language import Language, LanguageRegion
from kobo.apps.languages.models.transcription import (
    TranscriptionService,
    TranscriptionServiceLanguageM2M,
)
from kobo.apps.languages.models.translation import (
    TranslationService,
    TranslationServiceLanguageM2M,
)
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.fuzzy_int import FuzzyInt

from ..constants import GOOGLETS, GOOGLETX
from ..models import SubmissionExtras


class ValidateSubmissionTest(APITestCase):
    def setUp(self):
        user = User.objects.create_user(username='someuser', email='user@example.com')
        self.asset = Asset(
            owner=user,
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
        )
        self.asset.advanced_features = {}
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset_uid = self.asset.uid
        self.asset_url = f'/api/v2/assets/{self.asset.uid}/?format=json'
        self.client.force_login(user)

    def set_asset_advanced_features(self, features):
        self.asset.advanced_features = features
        self.asset.save()

    def test_asset_post_submission_extra_with_transcript(self):
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {
            'submission': 'abc123-def456',
            'q1': {
              'transcript': {
                'value': 'they said hello',
              }
            }
        }

        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')

        package['q1']['transcript'] = {'value': 'they said goodbye'}
        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')
        q1transcript = rr.json()['q1']['transcript']
        assert q1transcript['value'] == 'they said goodbye'

    def test_translation_revisions_stored_properly(self):
        self.set_asset_advanced_features({
            'translation': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            }
        })
        tx_instance = next(self.asset.get_advanced_feature_instances())
        first_post = {
            'q1': {
                'translation': {
                    'tx1': {
                        'value': 'VAL1'
                    }
                }
            }
        }
        summ = tx_instance.compile_revised_record({}, edits=first_post)
        assert summ['q1']['translation']['tx1']['value'] == 'VAL1'
        assert len(summ['q1']['translation']['tx1']['revisions']) == 0

        second_post = {
            'q1': {
                'translation': {
                    'tx1': {
                        'value': 'VAL2',
                    }
                }
            }
        }
        summ1 = tx_instance.compile_revised_record(
            deepcopy(summ), edits=second_post
        )
        assert summ1['q1']['translation']['tx1']['value'] == 'VAL2'
        assert len(summ1['q1']['translation']['tx1']['revisions']) == 1
        assert (
            summ1['q1']['translation']['tx1']['revisions'][0]['value'] == 'VAL1'
        )

    def test_transx_requires_change_asset_permission(self):
        """
        Submit a transcript and translation as the owning user; then, switch to
        another user and attempt editing with various permissions assigned
        """

        # Enable transcripts and translations for the example question
        self.set_asset_advanced_features(
            {
                'transcript': {'values': ['q1']},
                'translation': {
                    'values': ['q1'],
                    'languages': ['tx1', 'tx2'],
                },
            }
        )
        resp = self.client.get(self.asset_url)
        assert resp.status_code == 200
        schema = resp.json()['advanced_submission_schema']

        # Submit transcript and translation as the owner
        original_transcript = 'they said hello'
        original_translation = 'T H E Y   S A I D   H E L L O'
        package = {
            'submission': 'abc123-def456',
            'q1': {
                'transcript': {
                    'value': original_transcript,
                    'languageCode': 'en',
                },
                'translation': {
                    'tx1': {
                        'value': original_translation,
                        'languageCode': 'xx',
                    }
                },
            },
        }
        resp = self.client.post(schema['url'], package, format='json')
        assert resp.status_code == 200
        q1_transx = resp.json()['q1']
        assert q1_transx['transcript']['value'] == original_transcript
        assert q1_transx['translation']['tx1']['value'] == original_translation

        # Become a user with no access to the project
        other_user = User.objects.create(username='ethan')
        self.client.force_login(other_user)
        modified = deepcopy(package)
        modified_transcript = 'they said goodbye'
        modified_translation = 'T H E Y   S A I D   G O O D B Y E'
        modified['q1']['transcript']['value'] = modified_transcript
        modified['q1']['translation']['tx1']['value'] = modified_translation

        # Attempt to change transcript should be rejected with no permissions
        # assigned
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 404

        # …and should be rejected with any of these insufficient permissions
        # assigned
        self.asset.assign_perm(other_user, PERM_ADD_SUBMISSIONS)
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 404

        self.asset.assign_perm(other_user, PERM_VIEW_ASSET)
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 404

        self.asset.assign_perm(other_user, PERM_CHANGE_ASSET)
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 404

        self.asset.assign_perm(other_user, PERM_VIEW_SUBMISSIONS)
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 403

        # Original content should be intact after rejections
        extras = list(self.asset.submission_extras.all())
        assert len(extras) == 1
        extras = extras[0]
        assert extras.submission_uuid == 'abc123-def456'
        assert (
            extras.content['q1']['transcript']['value'] == original_transcript
        )
        assert (
            extras.content['q1']['translation']['tx1']['value']
            == original_translation
        )

        # Transcript modification should succeed after granting
        # 'change_submissions' permission
        self.asset.assign_perm(other_user, PERM_CHANGE_SUBMISSIONS)
        resp = self.client.post(schema['url'], modified, format='json')
        assert resp.status_code == 200
        q1_transx = resp.json()['q1']
        assert q1_transx['transcript']['value'] == modified_transcript
        assert q1_transx['translation']['tx1']['value'] == modified_translation
        extras = list(self.asset.submission_extras.all())
        assert len(extras) == 1
        extras = extras[0]
        assert extras.submission_uuid == 'abc123-def456'
        assert (
            extras.content['q1']['transcript']['value'] == modified_transcript
        )
        assert (
            extras.content['q1']['translation']['tx1']['value']
            == modified_translation
        )


class TranscriptFieldRevisionsOnlyTests(ValidateSubmissionTest):
    def setUp(self):
        ValidateSubmissionTest.setUp(self)
        self.set_asset_advanced_features({
            'transcript': {
                'values': ['q1'],
            }
        })
        self.act1 = next(self.asset.get_advanced_feature_instances())

    def test_simplest(self):
        field = self.act1.revise_field({
            'value': 'V1',
            'revisions': [],
            'dateCreated': '1',
            'dateModified': '1',
        }, {
            'value': 'V2',
        })
        assert field['value'] == 'V2'

    def test_send_delete_character(self):
        field = self.act1.revise_field({
            'value': 'V1',
            'revisions': [],
            'dateCreated': '1',
            'dateModified': '1',
        }, {
            'value': self.act1.DELETE,
        })
        assert field == {}


class TranslatedFieldRevisionsOnlyTests(ValidateSubmissionTest):
    def setUp(self):
        ValidateSubmissionTest.setUp(self)
        self.set_asset_advanced_features({
            'translation': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            }
        })
        self.txi = next(self.asset.get_advanced_feature_instances())

    def test_simplest(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V1',
                'revisions': [],
                'dateCreated': '1',
                'dateModified': '1',
            }
        }, {
            'tx1': {
                'value': 'V2',
            }
        })

        assert 'tx1' in field
        assert field['tx1']['value'] == 'V2'
        assert len(field['tx1']['revisions']) == 1
        assert field['tx1']['dateCreated'] == '1'
        assert 'dateCreated' not in field['tx1']['revisions'][0]
        assert 'dateModified' in field['tx1']
        assert field['tx1']['dateCreated'] == '1'

    def test_append_empty_string(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V1',
                'revisions': [],
                'dateCreated': '1',
                'dateModified': '1',
            }
        }, {
            'tx1': {
                'value': '',
            }
        })

        assert 'tx1' in field
        assert field['tx1']['value'] == ''

    def test_send_delete_character(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V1',
                'revisions': [],
                'dateCreated': '1',
                'dateModified': '1',
            }
        }, {
            'tx1': {
                'value': self.txi.DELETE,
            }
        })
        assert 'tx1' not in field

    def test_date_created_is_pulled_from_last_revision(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V3',
                'revisions': [
                    {'value': 'V2', 'dateModified': 'B'},
                    {'value': 'V1', 'dateModified': 'A'},
                ]
            }
        }, {
            'tx1': {
                'value': 'V4',
            }
        })
        for revision in field['tx1']['revisions']:
            assert 'revisions' not in revision
        assert field['tx1']['dateCreated'] == 'A'

    def test_second_translation_comes_in(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'T1',
                'dateModified': 'A',
                'dateCreated': 'A',
                'revisions': []
            }
        }, {
            'tx2': {
                'value': 'T2',
            }
        })
        for tx in ['tx1', 'tx2']:
            fx = field[tx]
            assert 'dateCreated' in fx
            assert 'dateModified' in fx
            assert 'revisions' in fx
        assert field['tx1']['dateCreated'] == 'A'

    def test_change_language_list(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'T1',
                'dateModified': 'A',
                'dateCreated': 'A',
                'revisions': []
            }
        }, {
            'tx2': {
                'value': 'T2',
            }
        })
        self.set_asset_advanced_features({
            'translation': {
                'languages': [
                    'tx1', 'tx3'
                ]
            }
        })
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {
            'submission': 'abc123-def456',
            'q1': {
                'transcript': {
                    'value': 'they said hello',
                },
            },
        }
        # validate(package, schema)


class GoogleNLPSubmissionTest(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.asset = Asset(
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]}
        )
        self.asset.advanced_features = {
            'transcript': {'languages': ['en']},
            'translation': {'languages': ['en', 'es']},
        }
        self.asset.owner = self.user
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset_url = f'/api/v2/assets/{self.asset.uid}/?format=json'
        self.client.force_login(self.user)
        transcription_service = TranscriptionService.objects.get(code='goog')
        translation_service = TranslationService.objects.get(code='goog')

        language = Language.objects.create(name='', code='')
        language_region = LanguageRegion.objects.create(language=language, name='', code='')
        TranscriptionServiceLanguageM2M.objects.create(
            language=language,
            region=language_region,
            service=transcription_service
        )
        TranslationServiceLanguageM2M.objects.create(
            language=language,
            region=language_region,
            service=translation_service
        )

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}},
        STRIPE_ENABLED=False,
    )
    @override_config(ASR_MT_INVITEE_USERNAMES='*')
    @patch('google.cloud.speech.SpeechClient')
    @patch('google.cloud.storage.Client')
    def test_google_transcript_post(self, m1, m2):
        url = reverse('advanced-submission-post', args=[self.asset.uid])
        submission_id = 'abc123-def456'
        submission = {
            '__version__': self.asset.latest_deployed_version.uid,
            'q1': 'audio_conversion_test_clip.3gp',
            '_uuid': submission_id,
            '_attachments': [
                {
                    'filename': 'someuser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                },
            ],
            '_submitted_by': self.user.username
        }
        self.asset.deployment.mock_submissions([submission])

        data = {
            'submission': submission_id,
            'q1': {GOOGLETS: {'status': 'requested', 'languageCode': ''}}
        }
        with self.assertNumQueries(FuzzyInt(49, 65)):
            res = self.client.post(url, data, format='json')
        self.assertContains(res, 'complete')
        with self.assertNumQueries(FuzzyInt(25, 35)):
            self.client.post(url, data, format='json')

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}},
        STRIPE_ENABLED=False,
    )
    def test_google_transcript_permissions(self):
        url = reverse('advanced-submission-post', args=[self.asset.uid])
        submission_id = 'abc123-def456'
        submission = {
            '__version__': self.asset.latest_deployed_version.uid,
            'q1': 'audio_conversion_test_clip.3gp',
            '_uuid': submission_id,
            '_attachments': [],
            '_submitted_by': self.user.username
        }
        self.asset.deployment.mock_submissions([submission])
        SubmissionExtras.objects.create(
            submission_uuid=submission_id,
            content={'q1': {'transcript': {'value': 'hello'}}},
            asset=self.asset
        )

        with override_config(ASR_MT_INVITEE_USERNAMES='*'):
            res = self.client.post(url, {}, format='json')
            self.assertEqual(res.status_code, 400)

        self.asset.permissions.all().delete()
        self.asset.owner = None
        self.asset.save()
        res = self.client.get(url + '?submission=' + submission_id, format='json')
        self.assertEqual(res.status_code, 404)

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}},
        STRIPE_ENABLED=False,
    )
    @override_config(ASR_MT_INVITEE_USERNAMES='*')
    @patch('kobo.apps.subsequences.integrations.google.google_translate.translate')
    @patch('kobo.apps.subsequences.integrations.google.base.storage')
    def test_google_translate_post(self, storage, translate):
        url = reverse('advanced-submission-post', args=[self.asset.uid])
        submission_id = 'abc123-def456'
        submission = {
            '__version__': self.asset.latest_deployed_version.uid,
            'q1': 'audio_conversion_test_clip.3gp',
            '_uuid': submission_id,
            '_attachments': [
                {
                    'id': 1,
                    'filename': 'someuser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                },
            ],
            '_submitted_by': self.user.username
        }
        self.asset.deployment.mock_submissions([submission])

        mock_translation_client = Mock()
        mock_translation_client.translate_text = Mock(return_value='Test translated text')
        translate.TranslationServiceClient = Mock(return_value=mock_translation_client)
        # Avoid error on isinstance call with this:
        translate.types = translate_v3.types
        data = {
            'submission': submission_id,
            'q1': {
                'transcript': {'value': 'test transcription',  'languageCode': ''},
                GOOGLETX: {'status': 'requested', 'languageCode': ''},
            }
        }
        res = self.client.post(url, data, format='json')
        self.assertContains(res, 'complete')
