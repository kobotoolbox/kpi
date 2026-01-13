import io
import json


class MockLLMClient:
    def __init__(self, response_text):
        self.response_text = response_text

    def invoke_model(self, *args, **kwargs):
        json_data = {
            'model': 'llm_model',
            'content': [{'text': self.response_text}],
            'usage': {'input_tokens': 10, 'output_tokens': 20},
        }
        return {'body': io.StringIO(json.dumps(json_data))}
