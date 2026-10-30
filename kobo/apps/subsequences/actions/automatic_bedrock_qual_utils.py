import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from json import JSONDecodeError

import boto3
from aws_bedrock_token_generator import provide_token
from botocore.config import Config
from django.conf import settings
from django_userforeignkey.request import get_current_request
from openai import OpenAI

from kobo.apps.subsequences.prompts import (
    MAX_TOKENS,
    MODEL_TEMPERATURE,
    InvalidResponseFromLLMException,
)


@dataclass
class LLModel:
    model_arn: str
    model_id: str
    path_to_response: str
    supports_reasoning: bool
    client_id: str

    def __repr__(self):
        return self.model_id

    @staticmethod
    def traverse_path(path_str: str, response_dict: dict) -> str:
        path = path_str.split('.')
        current_level = response_dict
        for path_component in path:
            if path_component.isdigit():
                current_level = current_level[int(path_component)]
            else:
                current_level = current_level[path_component]
        return current_level

    def get_response_text(self, response_dict):
        return self.traverse_path(self.path_to_response, response_dict)


ClaudeSonnet = LLModel(
    model_arn=settings.AUTOQA_CLAUDESONNET_MODEL_AIP_ARN,
    model_id='us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    path_to_response='content.0.text',
    supports_reasoning=False,
    client_id='runtime',
)
OSS120 = LLModel(
    model_id='openai.gpt-oss-120b-1:0',
    model_arn=settings.AUTOQA_OSS120_MODEL_AIP_ARN,
    path_to_response='choices.0.message.content',
    supports_reasoning=True,
    client_id='runtime',
)

Gemma4 = LLModel(
    model_id='google.gemma-4-31b',
    model_arn='google.gemma-4-31b',
    path_to_response='output.0.content.0.text',
    supports_reasoning=True,
    client_id='mantle',
)


class BedrockClient(ABC):

    # separated out for easier testing
    @abstractmethod
    def make_request(self, request_data: dict, model: LLModel) -> dict:
        pass

    @abstractmethod
    def process_response(self, response, model: LLModel) -> str:
        pass

    def get_response_from_llm(self, request_data: dict, model: LLModel) -> str:
        response = self.make_request(request_data, model)
        return self.process_response(response, model)


class MantleClient(BedrockClient):
    def __init__(self, *args, **kwargs):
        self.client = OpenAI(
            api_key=provide_token(region=settings.AWS_BEDROCK_REGION_NAME),
            base_url=f'https://bedrock-mantle'
            f'.{settings.AWS_BEDROCK_REGION_NAME}.api.aws/openai/v1',
        )

    def make_request(self, request_data, model):
        return self.client.responses.create(
            model=model.model_id,
            input=[request_data],
            temperature=MODEL_TEMPERATURE,
            max_output_tokens=MAX_TOKENS,
        )

    def process_response(self, response, model: LLModel):
        try:
            response_body = json.loads(response.json())
            if request := get_current_request():
                request.llm_response = {
                    'request_id': response._request_id,
                    'model': model.model_id,
                }
            return model.get_response_text(response_body)
        except (JSONDecodeError, IndexError, KeyError) as e:
            # the response isn't in the form we expected
            if request := get_current_request():
                request.llm_response = {
                    'error': 'Unable to extract answer from LLM response object',
                }
            raise InvalidResponseFromLLMException(
                'Unable to extract answer from LLM response object'
            ) from e


class RuntimeClient(BedrockClient):
    def __init__(self, *args, **kwargs):
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_BEDROCK_REGION_NAME,
            config=Config(
                read_timeout=settings.AWS_BEDROCK_READ_TIMEOUT,
                connect_timeout=settings.AWS_BEDROCK_CONNECT_TIMEOUT,
            ),
        )

    def make_request(self, request_data, model):
        if model.supports_reasoning:
            request_data = {**request_data, 'include_reasoning': False}
        return self.client.invoke_model(
            modelId=model.model_arn,
            body=json.dumps(request_data),
        )

    def process_response(self, response, model):
        try:
            if request := get_current_request():
                request.llm_response = {
                    'request_id': response['ResponseMetadata']['RequestId'],
                    'model': model.model_id,
                }
            return model.get_response_text(json.loads(response['body'].read()))
        except (JSONDecodeError, IndexError, KeyError) as e:
            # the response isn't in the form we expected
            if request := get_current_request():
                request.llm_response = {
                    'error': 'Unable to extract answer from LLM response object',
                }
            raise InvalidResponseFromLLMException(
                'Unable to extract answer from LLM response object'
            ) from e


CLIENTS_BY_NAME = {'mantle': MantleClient, 'runtime': RuntimeClient}
