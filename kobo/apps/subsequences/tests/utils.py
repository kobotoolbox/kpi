import io
import json

from kobo.apps.subsequences.actions.automatic_bedrock_qual import OSS120


def get_mock_oss_response(text='text'):
    return {
        'choices': [{'message': {'content': text}}],
    }


def get_mock_claude_response(text='text'):
    return {
        'content': [{'text': text}],
    }


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
