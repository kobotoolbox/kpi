import uuid
from datetime import timedelta
from unittest.mock import patch

import jsonschema
import pytest
from ddt import data, ddt, unpack
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.subsequences.actions.automatic_bedrock_qual import (
    AutomaticBedrockQual,
)
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kobo.apps.subsequences.tests.test_uuids import (
    UUID_BEDROCK_INTEGER,
    UUID_BEDROCK_SELECT_MULTIPLE,
    UUID_BEDROCK_SELECT_ONE,
    UUID_BEDROCK_TEXT,
    UUID_CHOICE_APATHY,
    UUID_CHOICE_EMPATHY,
    UUID_CHOICE_NO,
    UUID_CHOICE_YES,
    UUID_TEST_CHOICE,
    UUID_TEST_MAIN,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase

valid_external_data = []


@ddt
class TestAutomaticBedrockQual(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        action_params = [
            {
                'type': 'qualInteger',
                'uuid': UUID_BEDROCK_INTEGER,
                'labels': {'_default': 'How many characters appear in the story?'},
            },
            {
                'type': 'qualSelectMultiple',
                'uuid': UUID_BEDROCK_SELECT_MULTIPLE,
                'labels': {'_default': 'What themes were present in the story?'},
                'choices': [
                    {
                        'uuid': UUID_CHOICE_EMPATHY,
                        'labels': {'_default': 'Empathy'},
                    },
                    {
                        'uuid': UUID_CHOICE_APATHY,
                        'labels': {'_default': 'Apathy'},
                    },
                ],
            },
            {
                'type': 'qualSelectOne',
                'uuid': UUID_BEDROCK_SELECT_ONE,
                'labels': {'_default': 'Was this a first-hand account?'},
                'choices': [
                    {
                        'uuid': UUID_CHOICE_YES,
                        'labels': {'_default': 'Yes'},
                    },
                    {
                        'uuid': UUID_CHOICE_NO,
                        'labels': {'_default': 'No'},
                    },
                ],
            },
            {
                'type': 'qualText',
                'uuid': UUID_BEDROCK_TEXT,
                'labels': {'_default': 'Add any further remarks'},
            },
        ]
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.feature = QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            action=Action.AUTOMATIC_BEDROCK_QUAL,
            params=action_params,
            question_xpath='q1',
        )
        self.feature.save()
        self.action = self.feature.to_action()

    @data(
        # type, main label, choice label, should pass?
        ('qualInteger', 'How many?', None, True),
        ('qualInteger', 'How many?', 'This should not be here', False),
        ('qualInteger', None, None, False),
        ('qualText', 'Why?', None, True),
        ('qualText', 'Why?', 'This should not be here', False),
        ('qualText', None, None, False),
        ('qualSelectOne', 'Select one', None, False),
        ('qualSelectOne', 'Select one', 'Choice A', True),
        ('qualSelectOne', None, 'Choice A', False),
        ('qualSelectMultiple', 'Select many', None, False),
        ('qualSelectMultiple', 'Select many', 'Choice A', True),
        ('qualSelectMultiple', None, 'Choice A', False),
        # notes and tags not allowed in automatic QA
        ('qualNote', 'Note', None, False),
        ('qualTags', 'Tag', None, False),
        ('badType', 'label', None, False),
        (None, 'label', None, False),
    )
    @unpack
    def test_valid_params(self, question_type, main_label, choice_label, should_pass):
        main_uuid = UUID_TEST_MAIN
        choice_uuid = UUID_TEST_CHOICE
        param = {'uuid': main_uuid}
        if question_type:
            param['type'] = question_type
        if main_label:
            param['labels'] = {'_default': main_label}
        if choice_label:
            param['choices'] = [
                {'uuid': choice_uuid, 'labels': {'_default': choice_label}}
            ]
        if should_pass:
            AutomaticBedrockQual.validate_params([param])
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                AutomaticBedrockQual.validate_params([param])

    def test_valid_user_data(self):
        for param in self.feature.params:
            if param['type'] == 'qualNote':
                continue
            uuid_ = param['uuid']
            self.action.validate_data({'uuid': uuid_})

    def test_invalid_user_data_no_uuid(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({})

    def test_invalid_user_data_extra_field(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data(
                {'uuid': UUID_BEDROCK_TEXT, 'other': 'stuff'}
            )

    def test_invalid_user_data_type_note(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-note'})

    # uuid, value, status, error, good
    @data(
        (UUID_BEDROCK_TEXT, 'Hi', 'complete', None, True),
        (UUID_BEDROCK_TEXT, '', 'complete', None, True),
        (UUID_BEDROCK_TEXT, None, 'complete', None, False),
        (UUID_BEDROCK_TEXT, None, 'failed', 'error', True),
        (UUID_BEDROCK_TEXT, None, 'failed', None, False),
        (UUID_BEDROCK_TEXT, 'Hi', 'failed', 'error', False),
        (UUID_BEDROCK_INTEGER, 1, 'complete', None, True),
        (UUID_BEDROCK_INTEGER, 0, 'complete', None, True),
        (UUID_BEDROCK_INTEGER, None, 'failed', 'error', True),
        (UUID_BEDROCK_INTEGER, 1, 'failed', 'error', False),
        (
            UUID_BEDROCK_SELECT_ONE,
            UUID_CHOICE_YES,
            'complete',
            None,
            True,
        ),
        (UUID_BEDROCK_SELECT_ONE, '', 'complete', None, True),
        (UUID_BEDROCK_SELECT_ONE, None, 'complete', None, False),
        (UUID_BEDROCK_SELECT_ONE, 'uuid-bad', 'complete', None, False),
        (UUID_BEDROCK_SELECT_ONE, None, 'failed', 'error', True),
        (
            UUID_BEDROCK_SELECT_ONE,
            UUID_CHOICE_YES,
            'failed',
            'error',
            False,
        ),
        (
            UUID_BEDROCK_SELECT_MULTIPLE,
            [UUID_CHOICE_EMPATHY],
            'complete',
            None,
            True,
        ),
        (UUID_BEDROCK_SELECT_MULTIPLE, [], 'complete', None, True),
        (UUID_BEDROCK_SELECT_MULTIPLE, None, 'complete', None, False),
        (UUID_BEDROCK_SELECT_MULTIPLE, ['uuid-bad'], 'complete', None, False),
        (UUID_BEDROCK_SELECT_MULTIPLE, None, 'failed', 'error', True),
        (
            UUID_BEDROCK_SELECT_MULTIPLE,
            [UUID_CHOICE_EMPATHY],
            'failed',
            'error',
            False,
        ),
    )
    @unpack
    def test_valid_external_data(self, uuid, value, status, error, accept):
        data = {'uuid': uuid, 'status': status}
        if value is not None:
            data['value'] = value
        if error:
            data['error'] = error
        if accept:
            self.action.validate_external_data(data)
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                self.action.validate_external_data(data)

    def test_update_supplement_api(self):
        u = self.asset.owner
        self.client.force_login(u)
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        uuid_ = uuid.uuid4()
        submission_uuid = str(uuid_)

        # add a submission
        submission_data = {
            'q1': 'answer',
            '_uuid': submission_uuid,
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission_data])
        # enable transcription
        QuestionAdvancedFeature.objects.create(
            question_xpath='q1',
            asset=self.asset,
            action=Action.MANUAL_TRANSCRIPTION,
            params=[{'language': 'en'}],
        )
        # add a transcription
        supplement_details_url = reverse(
            'api_v2:submission-supplement',
            args=[self.asset.uid, submission_uuid],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                Action.MANUAL_TRANSCRIPTION: {
                    'language': 'en',
                    'value': 'transcription',
                },
            },
        }
        self.client.patch(supplement_details_url, data=payload, format='json')

        payload = {
            '_version': '20250820',
            'q1': {
                Action.AUTOMATIC_BEDROCK_QUAL: {
                    'uuid': UUID_BEDROCK_TEXT,
                },
            },
        }
        return_val = {'value': 'LLM text', 'status': 'complete'}
        with patch.object(
            AutomaticBedrockQual, 'run_external_process', return_value=return_val
        ):
            response = self.client.patch(
                supplement_details_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_200_OK
        transcript = response.data['q1'][Action.MANUAL_TRANSCRIPTION]['_versions'][0]
        transcript_uuid = transcript['_uuid']
        version = response.data['q1'][Action.AUTOMATIC_BEDROCK_QUAL][
            UUID_BEDROCK_TEXT
        ]['_versions'][0]
        version_data = version['_data']
        assert version_data['value'] == 'LLM text'
        assert version_data['status'] == 'complete'
        assert version['_dependency']['_uuid'] == transcript_uuid
        assert version['_dependency']['_actionId'] == Action.MANUAL_TRANSCRIPTION

    def test_transform_data_filters_out_failed_versions(self):
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        action_data = {
            UUID_BEDROCK_TEXT: {
                '_versions': [
                    {
                        '_data': {
                            'uuid': UUID_BEDROCK_TEXT,
                            'status': 'failed',
                            'error': 'Something went wrong',
                        },
                        '_dateCreated': today.isoformat(),
                        '_uuid': 'v2',
                    },
                    {
                        '_data': {
                            'uuid': UUID_BEDROCK_TEXT,
                            'value': 'Initial note',
                        },
                        '_dateCreated': yesterday.isoformat(),
                        '_dateAccepted': yesterday.isoformat(),
                        '_uuid': 'v1',
                    },
                ],
                '_dateCreated': yesterday.isoformat(),
                '_dateModified': today.isoformat(),
            }
        }

        output = self.action.transform_data_for_output(action_data)
        assert len(output.keys()) == 1

        text_item = output.get(('qual', UUID_BEDROCK_TEXT))
        # take the initial note because the most recent request to overwrite failed
        assert text_item['value'] == 'Initial note'
        assert 'error' not in text_item
