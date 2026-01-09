# update this file to tinker with LLM prompts. Unparseable responses should raise
# and "InvalidResponseFromLLMException"
import re

from kobo.apps.subsequences.constants import (
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_SELECT_MULTIPLE,
    QUESTION_TYPE_SELECT_ONE,
    QUESTION_TYPE_TEXT,
)

response_placeholder = '{{interviewResponse}}'
analysis_question_placeholder = '{{analysisQuestion}}'
num_choice_placeholder = '{{numChoices}}'
example_format_placeholder = '{{exampleFormat}}'
choices_list_placeholder = '{{choicesList}}'

MODEL_TEMPERATURE = 0.1
MAX_TOKENS = 1000


class InvalidResponseFromLLMException(Exception):
    pass


PROMPTS_BY_QUESTION_TYPE = {
    QUESTION_TYPE_INTEGER: 'Carefully analyze the interview response below to enable '
    'you to answer the analysis question. The analysis question is listed below the '
    'interview response. You must determine a numerical value that answers that '
    'question. Only provide the number, no additional text.'
    '\n\nInterview Response: {{interviewResponse}}'
    '\n\nAnalysis Question: {{analysisQuestion}}',
    QUESTION_TYPE_TEXT: 'You are analyzing an interview response to answer a specific'
    ' question. Follow these rules:'
    '\n\n1. BASE YOUR ANSWER ONLY ON EVIDENCE: Only use '
    'information explicitly stated in the interview response. '
    'Do not infer, assume, or speculate beyond what is directly '
    'stated.'
    '\n\n2. ACKNOWLEDGE UNCERTAINTY: If the interview response '
    'does not contain sufficient information to answer the '
    'question, clearly state "The interview response does not '
    'contain information to answer this question" or similar.'
    '\n\n3. BE OBJECTIVE AND UNBIASED: Avoid language that could '
    'be discriminatory based on protected characteristics. '
    'Focus on factual, observable statements.'
    '\n\n4. PROTECT PRIVACY: Do not repeat unnecessary personal '
    'identifiers (names, addresses, etc.) in your analysis unless '
    'directly relevant to the question.'
    '\n\n5. BE CONCISE: Keep your response brief and directly '
    'address the question.'
    '\n\nInterview Response:'
    '\n{{interviewResponse}}'
    '\nAnalysis Question: {{analysisQuestion}}'
    '\n\nProvide your analysis:',
    QUESTION_TYPE_SELECT_MULTIPLE: 'Carefully analyze the interview response below to '
    'enable you to determine which of the options should apply to the analysis '
    'question. The analysis question and options are listed below the interview '
    'response.'
    '\n\nInterview Response: {{interviewResponse}}'
    '\n\nAnalysis Question: {{analysisQuestion}}'
    '\n\nIMPORTANT: Select only the options from the list below that best apply to the '
    'analysis question (if any). Respond ONLY with exactly {{numChoices}} boolean '
    'values separated by commas, representing TRUE or FALSE for each option. Multiple '
    'options can be TRUE. If no option applies, respond with {{numChoices}} FALSE '
    'values. The response must be in this exact format: {{exampleFormat}} '
    '(example format).'
    '\n\nOptions to analyze:'
    '\n{{choicesList}}'
    '\n\nYour response must match the exact format described above. Do not include any '
    'additional text or comments.',
    QUESTION_TYPE_SELECT_ONE: 'Carefully analyze the interview response below to '
    'enable you to determine which ONE of the provided options (if any) best applies '
    'to the analysis question. The analysis question and options are listed below the '
    'interview response. You must select ONLY ONE option, or NONE if no option applies.'
    '\n\nInterview Response: {{interviewResponse}}'
    '\n\nAnalysis Question: {{analysisQuestion}}{{hint}}'
    '\n\nIMPORTANT: Select ONLY ONE option from the list below, or NONE if no option '
    'applies. Respond ONLY with exactly {{numChoices}} boolean values separated by '
    'commas, representing TRUE or FALSE for each option. Only ONE option should be '
    'TRUE, all others should be FALSE. If no option applies, respond with '
    '{{numChoices}} FALSE values. The response must be in this exact format: '
    '{{exampleFormat}} (example format).'
    '\n\nOptions to analyze:'
    '\n{{choicesList}}'
    '\n\nYour response must match the exact format described above. Do not include '
    'any additional text or comments.',
}


def format_choices(choices: list[str]) -> str:
    """
    Format choices to pass in the LLM prompt

    Update this method to change what goes in the {{ choicesList }} placeholder

    :param choices: list[str] List of choices as strings, eg ['Yes', 'No', 'Maybe']
    :return: formatted choices as string
    """
    enumerated_choices = [f'{i}. {choice}' for i, choice in enumerate(choices)]
    return '\n'.join(enumerated_choices)


def get_example_format(question_type: str, num_choices: int) -> str:
    """
    Given n choices, return a comma-separated string of n values either TRUE or FALSE

    Used to help the LLM return the response in the correct format. Update this method
    to change what goes in the {{example_format}} placeholder. If you update this, you
    will likely need to update `parse_choices_response` below

    :param question_type: str 'qualSelectOne' or 'qualSelectMultiple'
    :param num_choices: int Number of available choices
    :return: str formatted example response for the LLM to use as guidance
    """
    response_array = ['FALSE'] * num_choices
    swap_index = (
        min(1, num_choices - 1)
        if question_type == QUESTION_TYPE_SELECT_ONE
        else min(3, num_choices - 1)
    )
    response_array[swap_index] = 'TRUE'
    response_array[swap_index] = 'TRUE'
    return ','.join(response_array)


def parse_choices_response(
    response_text: str, expected_choices_count: int, allow_multiple: bool
) -> list[int]:
    """
    Given an LLM response to a question with choices, return the index(es) of the
    selected choice(s)

    Update this method to change how responses to select questions are processed

    :param response_text: str The LLM response to parse
    :param expected_choices_count: int The total number of available choices
    :param allow_multiple: bool Whether to allow multiple selections or not
    :return: list[int] Index(es) of the selected choice(s)
    """
    expected_regex = fr'((TRUE|FALSE),){{{expected_choices_count-1}}}(TRUE|FALSE)'
    if not re.match(expected_regex, response_text):
        raise InvalidResponseFromLLMException(
            f'LLM returned unexpected response {response_text}'
        )
    separated_answers = response_text.split(',')
    selected_answer_indexes = [
        i for i, value in enumerate(separated_answers) if value == 'TRUE'
    ]
    if not allow_multiple and len(selected_answer_indexes) > 1:
        raise InvalidResponseFromLLMException(
            'LLM returned multiple answers for a single select'
        )
    return selected_answer_indexes


def parse_integer_response(response_text: str) -> int:
    """
    Given an LLM response to an integer question, return the response as an integer

    Update this method for more sophisticated processing if necessary

    :param response_text: str The LLM response to parse, eg "3"
    :return: int
    """
    try:
        return int(response_text)
    except ValueError:
        raise InvalidResponseFromLLMException(
            f'LLM returned non-integer' f' response {response_text}'
        )


def parse_text_response(response_text: str) -> str:
    """
    Given an LLM response to an text question, return the response

    Update this method for more sophisticated processing if necessary

    :param response_text: str The LLM response to parse, eg "Frogs"
    :return: str
    """
    return response_text
