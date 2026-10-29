import json
from io import StringIO

from kobo.apps.subsequences.actions.automatic_bedrock_qual import OSS120
from kobo.apps.subsequences.actions.automatic_bedrock_qual_utils import (
    Gemma4,
)


class MockMantleResponse:
    def __init__(self, response_dict, request_id=1234):
        self.response_dict = response_dict
        self._request_id = request_id

    def json(self):
        return self.response_dict


class MockRuntimeResponse:
    def __init__(self, response_dict, request_id=1234):
        self.data = {
            'body': StringIO(json.dumps(response_dict)),
            'ResponseMetadata': {'RequestId': request_id},
        }

    def __getitem__(self, key):
        return self.data[key]


def get_mock_oss_response(text='text'):
    return MockRuntimeResponse(
        {
            'choices': [{'message': {'content': text}}],
        }
    )


def get_mock_claude_response(text='text'):
    return MockRuntimeResponse(
        {
            'content': [{'text': text}],
        }
    )


def get_mock_gemma_response(text='text'):
    return MockMantleResponse({'output': [{'content': [{'text': text}]}]})


def mock_get_response(model, text='text'):
    if model.model_id == Gemma4.model_id:
        return get_mock_gemma_response(text)
    elif model.model_id == OSS120.model_id:
        return get_mock_oss_response(text)
    else:
        return get_mock_claude_response(text)
