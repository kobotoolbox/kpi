import uuid
from copy import deepcopy
from unittest.mock import Mock, patch

import pytest
from constance.test import override_config
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from google.cloud import translate_v3
from jsonschema import validate
from rest_framework import status
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
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kobo.apps.organizations.constants import UsageType
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
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)
from ..constants import GOOGLETS, GOOGLETX
from ..models import SubmissionExtras


class BaseSubsequenceTestCase(APITestCase):

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

        uuid_ = uuid.uuid4()
        self.submission_uuid = str(uuid_)

        # add a submission
        submission_data = {
            'q1': 'answer',
            '_uuid': self.submission_uuid,
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission_data])

        self.client.force_login(user)

    def set_asset_advanced_features(self, features):
        self.asset.advanced_features = features
        self.asset.save()


class ValidateSubmissionTest(BaseSubsequenceTestCase):

    def test_get_submission_with_nonexistent_instance_404s(self):
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        base_url = resp.json()['advanced_submission_schema']['url']
        url = f'{base_url}?submission=bad-uuid'
        rr = self.client.get(url)
        assert rr.status_code == 404

    def test_get_submission_after_edit(self):
        # Simulate edit
        instance = Instance.objects.only('pk').get(root_uuid=self.submission_uuid)
        deployment = self.asset.deployment
        new_uuid = str(uuid.uuid4())
        xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_DEPRECATED_UUID_XPATH,
            add_uuid_prefix(self.submission_uuid),
        )
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_ROOT_UUID_XPATH,
            add_uuid_prefix(instance.root_uuid),
        )
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_CURRENT_UUID_XPATH,
            add_uuid_prefix(new_uuid),
        )
        instance.xml = xml_tostring(xml_parsed)
        instance.uuid = new_uuid
        instance.save()
        assert instance.root_uuid == self.submission_uuid

        # Retrieve advanced submission schema for edited submission
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        base_url = resp.json()['advanced_submission_schema']['url']
        url = f'{base_url}?submission={self.submission_uuid}'
        rr = self.client.get(url)
        assert rr.status_code == status.HTTP_200_OK

    def test_get_submission_with_null_root_uuid(self):
        # Simulate an old submission (never edited) where `root_uuid` was not yet set
        Instance.objects.filter(root_uuid=self.submission_uuid).update(root_uuid=None)

        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        base_url = resp.json()['advanced_submission_schema']['url']
        url = f'{base_url}?submission={self.submission_uuid}'
        rr = self.client.get(url)
        assert rr.status_code == status.HTTP_200_OK

    def test_post_submission_extra_with_nonexistent_instance_404s(self):
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {
            'submission': 'bad-uuid',
            'q1': {
                'transcript': {
                    'value': 'they said hello',
                }
            },
        }
        rr = self.client.post(schema['url'], package, format='json')
        assert rr.status_code == 404

    def test_asset_post_submission_extra_with_transcript(self):
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {
            'submission': self.submission_uuid,
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
            'submission': self.submission_uuid,
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
        assert extras.submission_uuid == self.submission_uuid
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
        assert extras.submission_uuid == self.submission_uuid
        assert (
            extras.content['q1']['transcript']['value'] == modified_transcript
        )
        assert (
            extras.content['q1']['translation']['tx1']['value']
            == modified_translation
        )


class TranscriptFieldRevisionsOnlyTests(BaseSubsequenceTestCase):

    def setUp(self):
        super().setUp()
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


class TranslatedFieldRevisionsOnlyTests(BaseSubsequenceTestCase):

    def setUp(self):
        super().setUp()
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
            'submission': self.submission_uuid,
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

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}},
    )
    @override_config(ASR_MT_INVITEE_USERNAMES='*')
    @patch('kobo.apps.subsequences.integrations.google.google_translate.translate')
    @patch('google.cloud.speech.SpeechClient')
    @patch('google.cloud.storage.Client')
    def test_google_services_usage_limit_checks(self, m1, m2, translate):
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
            '_submitted_by': self.user.username,
        }
        self.asset.deployment.mock_submissions([submission])
        mock_translation_client = Mock()
        mock_translation_client.translate_text = Mock(
            return_value='Test translated text'
        )
        translate.TranslationServiceClient = Mock(return_value=mock_translation_client)
        # Avoid error on isinstance call with this:
        translate.types = translate_v3.types

        data = {
            'submission': submission_id,
            'q1': {GOOGLETS: {'status': 'requested', 'languageCode': ''}},
        }

        mock_balances = {
            UsageType.ASR_SECONDS: {'exceeded': True},
            UsageType.MT_CHARACTERS: {'exceeded': True},
        }
        with patch(
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',
            return_value=mock_balances,
        ):
            data = {
                'submission': submission_id,
                'q1': {GOOGLETS: {'status': 'requested', 'languageCode': ''}},
            }
            res = self.client.post(url, data, format='json')
            assert res.status_code == status.HTTP_402_PAYMENT_REQUIRED

            data = {
                'submission': submission_id,
                'q1': {
                    'transcript': {'value': 'test transcription', 'languageCode': ''},
                    GOOGLETX: {'status': 'requested', 'languageCode': ''},
                },
            }
            res = self.client.post(url, data, format='json')
            assert res.status_code == status.HTTP_402_PAYMENT_REQUIRED

        mock_balances = {
            UsageType.ASR_SECONDS: {'exceeded': False},
            UsageType.MT_CHARACTERS: {'exceeded': False},
        }
        with patch(
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',
            return_value=mock_balances,
        ):
            data = {
                'submission': submission_id,
                'q1': {GOOGLETS: {'status': 'requested', 'languageCode': ''}},
            }
            res = self.client.post(url, data, format='json')
            self.assertContains(res, 'complete')

            data = {
                'submission': submission_id,
                'q1': {
                    'transcript': {'value': 'test transcription', 'languageCode': ''},
                    GOOGLETX: {'status': 'requested', 'languageCode': ''},
                },
            }
            res = self.client.post(url, data, format='json')
            self.assertContains(res, 'complete')

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
