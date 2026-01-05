import uuid
from datetime import timedelta
from unittest.mock import patch

import jsonschema
import pytest
from ddt import data, ddt, unpack
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.subsequences.actions.automatic_chained_qual import (
    AutomaticChainedQualAction,
)
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase

valid_external_data = []


@ddt
class TestAutomaticChainedQual(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        action_params = [
            {
                'type': 'qualInteger',
                'uuid': 'uuid-qual-integer',
                'labels': {'_default': 'How many characters appear in the story?'},
            },
            {
                'type': 'qualSelectMultiple',
                'uuid': 'uuid-qual-select-multiple',
                'labels': {'_default': 'What themes were present in the story?'},
                'choices': [
                    {
                        'uuid': 'uuid-empathy',
                        'labels': {'_default': 'Empathy'},
                    },
                    {
                        'uuid': 'uuid-apathy',
                        'labels': {'_default': 'Apathy'},
                    },
                ],
            },
            {
                'type': 'qualSelectOne',
                'uuid': 'uuid-qual-select-one',
                'labels': {'_default': 'Was this a first-hand account?'},
                'choices': [
                    {
                        'uuid': 'uuid-yes',
                        'labels': {'_default': 'Yes'},
                    },
                    {
                        'uuid': 'uuid-no',
                        'labels': {'_default': 'No'},
                    },
                ],
            },
            {
                'type': 'qualText',
                'uuid': 'uuid-qual-text',
                'labels': {'_default': 'Add any further remarks'},
            },
        ]
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.feature = QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            action=Action.AUTOMATIC_CHAINED_QUAL,
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
        main_uuid = 'main_uuid'
        choice_uuid = 'choice_uuid'
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
            AutomaticChainedQualAction.validate_params([param])
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                AutomaticChainedQualAction.validate_params([param])

    def test_valid_user_data(self):
        for param in self.feature.params:
            if param['type'] == 'qualNote':
                continue
            uuid = param['uuid']
            self.action.validate_data({'uuid': uuid})

    def test_invalid_user_data_no_uuid(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({})

    def test_invalid_user_data_extra_field(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-text', 'other': 'stuff'})

    def test_invalid_user_data_type_note(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-note'})

    # uuid, value, status, error, good
    @data(
        ('uuid-qual-text', 'Hi', 'complete', None, True),
        ('uuid-qual-text', '', 'complete', None, True),
        ('uuid-qual-text', None, 'complete', None, False),
        ('uuid-qual-text', None, 'failed', 'error', True),
        ('uuid-qual-text', None, 'failed', None, False),
        ('uuid-qual-text', 'Hi', 'failed', 'error', False),
        ('uuid-qual-integer', 1, 'complete', None, True),
        ('uuid-qual-integer', 0, 'complete', None, True),
        ('uuid-qual-integer', None, 'failed', 'error', True),
        ('uuid-qual-integer', 1, 'failed', 'error', False),
        ('uuid-qual-select-one', 'uuid-yes', 'complete', None, True),
        ('uuid-qual-select-one', '', 'complete', None, True),
        ('uuid-qual-select-one', None, 'complete', None, False),
        ('uuid-qual-select-one', 'uuid-bad', 'complete', None, False),
        ('uuid-qual-select-one', None, 'failed', 'error', True),
        ('uuid-qual-select-one', 'uuid-yes', 'failed', 'error', False),
        ('uuid-qual-select-multiple', ['uuid-empathy'], 'complete', None, True),
        ('uuid-qual-select-multiple', [], 'complete', None, True),
        ('uuid-qual-select-multiple', None, 'complete', None, False),
        ('uuid-qual-select-multiple', ['uuid-bad'], 'complete', None, False),
        ('uuid-qual-select-multiple', None, 'failed', 'error', True),
        ('uuid-qual-select-multiple', ['uuid-empathy'], 'failed', 'error', False),
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
                Action.AUTOMATIC_CHAINED_QUAL: {
                    'uuid': 'uuid-qual-text',
                },
            },
        }
        return_val = {'value': 'LLM text', 'status': 'complete'}
        with patch.object(
            AutomaticChainedQualAction, 'run_external_process', return_value=return_val
        ):
            response = self.client.patch(
                supplement_details_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_200_OK
        transcript = response.data['q1'][Action.MANUAL_TRANSCRIPTION]['_versions'][0]
        transcript_uuid = transcript['_uuid']
        version = response.data['q1'][Action.AUTOMATIC_CHAINED_QUAL]['uuid-qual-text'][
            '_versions'
        ][0]
        version_data = version['_data']
        assert version_data['value'] == 'LLM text'
        assert version_data['status'] == 'complete'
        assert version['_dependency']['_uuid'] == transcript_uuid
        assert version['_dependency']['_actionId'] == Action.MANUAL_TRANSCRIPTION

    def test_transform_data_filters_out_failed_versions(self):
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        action_data = {
            'uuid-qual-text': {
                '_versions': [
                    {
                        '_data': {
                            'uuid': 'uuid-qual-text',
                            'status': 'failed',
                            'error': 'Something went wrong',
                        },
                        '_dateCreated': today.isoformat(),
                        '_uuid': 'v1',
                    },
                    {
                        '_data': {'uuid': 'uuid-qual-text', 'value': 'Initial note'},
                        '_dateCreated': yesterday.isoformat(),
                        '_dateAccepted': yesterday.isoformat(),
                        '_uuid': 'v2',
                    },
                ],
                '_dateCreated': yesterday.isoformat(),
                '_dateModified': today.isoformat(),
            }
        }

        output = self.action.transform_data_for_output(action_data)
        assert len(output.keys()) == 1

        text_item = output.get(('qual', 'uuid-qual-text'))
        # take the initial note because the most recent request to overwrite failed
        assert text_item['value'] == 'Initial note'
