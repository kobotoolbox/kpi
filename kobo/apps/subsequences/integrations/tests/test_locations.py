from unittest.mock import patch

from kobo.apps.subsequences.integrations.google.locations import (
    get_asr_language_code_overrides,
)


@patch('kobo.apps.subsequences.integrations.google.locations.constance')
def test_get_asr_language_code_overrides_parses_default_sw_mapping(mock_constance):
    mock_constance.config.ASR_LANGUAGE_CODE_OVERRIDES = 'sw:auto,sw-KE:auto'

    assert get_asr_language_code_overrides() == {'sw': 'auto', 'sw-KE': 'auto'}


@patch('kobo.apps.subsequences.integrations.google.locations.constance')
def test_get_asr_language_code_overrides_returns_empty_dict_for_empty_value(
    mock_constance,
):
    mock_constance.config.ASR_LANGUAGE_CODE_OVERRIDES = ''

    assert get_asr_language_code_overrides() == {}


@patch('kobo.apps.subsequences.integrations.google.locations.constance')
def test_get_asr_language_code_overrides_strips_whitespace(mock_constance):
    mock_constance.config.ASR_LANGUAGE_CODE_OVERRIDES = ' sw : auto , sw-KE : auto '

    assert get_asr_language_code_overrides() == {'sw': 'auto', 'sw-KE': 'auto'}


@patch('kobo.apps.subsequences.integrations.google.locations.constance')
def test_get_asr_language_code_overrides_skips_only_malformed_entries(
    mock_constance,
):
    """
    A single malformed entry (missing colon, empty source, or empty target)
    must not discard the other valid overrides in the same value
    """
    mock_constance.config.ASR_LANGUAGE_CODE_OVERRIDES = (
        'sw:auto,invalid,fr:,:es,sw-KE:auto'
    )

    assert get_asr_language_code_overrides() == {'sw': 'auto', 'sw-KE': 'auto'}


@patch('kobo.apps.subsequences.integrations.google.locations.constance')
def test_get_asr_language_code_overrides_returns_empty_dict_when_all_invalid(
    mock_constance,
):
    mock_constance.config.ASR_LANGUAGE_CODE_OVERRIDES = 'invalid,fr:,:es'

    assert get_asr_language_code_overrides() == {}
