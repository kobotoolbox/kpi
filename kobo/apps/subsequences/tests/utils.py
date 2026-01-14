import io
import json

from kobo.apps.subsequences.actions.automatic_bedrock_qual import OSS120


def get_mock_oss_response(text='text', input_tokens=10, output_tokens=20):
    return {
        'model': 'oss',
        'choices': [{'message': {'content': text}}],
        'usage': {'prompt_tokens': input_tokens, 'completion_tokens': output_tokens},
    }


def get_mock_claude_response(text='text', input_tokens=10, output_tokens=20):
    return {
        'model': 'claude',
        'content': [{'text': text}],
        'usage': {'input_tokens': input_tokens, 'output_tokens': output_tokens},
    }


class MockLLMClient:
    def __init__(self, response_text):
        self.response_text = response_text

    def invoke_model(self, modelId, *args, **kwargs):
        if modelId == OSS120.model_id:
            json_data = get_mock_oss_response(self.response_text)
        else:
            json_data = get_mock_claude_response(self.response_text)
        return {'body': io.StringIO(json.dumps(json_data))}
