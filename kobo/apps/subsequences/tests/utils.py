import io
import json
from unittest.mock import MagicMock

from kobo.apps.subsequences.actions.automatic_bedrock_qual import OSS120
from kobo.apps.subsequences.tests.constants import TEXT_QUESTION_XPATH


def get_mock_oss_response(text='text'):
    return {
        'choices': [{'message': {'content': text}}],
    }


def get_mock_claude_response(text='text'):
    return {
        'content': [{'text': text}],
    }


def get_mock_text_question_asset():
    """
    Return a mock asset whose survey has a single text question, at
    `TEXT_QUESTION_XPATH`
    """

    mock_asset = MagicMock()
    mock_asset.pk = 1
    mock_asset.owner.pk = 1
    mock_asset.content = {
        'survey': [
            {
                'type': 'text',
                'name': TEXT_QUESTION_XPATH,
                '$xpath': TEXT_QUESTION_XPATH,
            }
        ]
    }
    # A mock has no unset attributes, so spell out what the survey metadata
    # helper relies on: nothing memoized yet, and no deployed version to cache
    # against
    mock_asset._survey_metadata = None
    mock_asset.latest_deployed_version_uid = None
    return mock_asset


class MockLLMClient:
    def __init__(self, response_text):
        self.response_text = response_text

    def invoke_model(self, modelId, *args, **kwargs):
        if modelId == OSS120.model_arn:
            json_data = get_mock_oss_response(self.response_text)
        else:
            json_data = get_mock_claude_response(self.response_text)
        return {
            'ResponseMetadata': {'RequestId': '12345'},
            'body': io.StringIO(json.dumps(json_data)),
        }
