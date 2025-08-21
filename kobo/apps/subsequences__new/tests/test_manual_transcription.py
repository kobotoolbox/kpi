import copy
import dateutil
import jsonschema
import pytest

from ..actions.manual_transcription import ManualTranscriptionAction


def cur_time():
    import datetime
    from zoneinfo import ZoneInfo

    return (
        datetime.datetime.now(tz=ZoneInfo('UTC'))
        .isoformat()
        .replace("+00:00", "Z")
    )


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    ManualTranscriptionAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        ManualTranscriptionAction.validate_params(params)


def test_valid_transcript_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranscriptionAction(xpath, params)
    data = {'language': 'fr', 'transcript': 'Ne pas idée'}
    action.validate_data(data)


def test_invalid_transcript_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranscriptionAction(xpath, params)
    data = {'language': 'en', 'transcript': 'No idea'}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)


def test_transcript_is_stored_in_supplemental_details():
    pass


def test_transcript_revisions_are_retained_in_supplemental_details():
    fake_sup_det = {}

    def get_supplemental_details():
        return fake_sup_det

    def revise_supplemental_details(new):
        existing = fake_sup_det  # modify directly
        revisions = existing.pop('_revisions', [])
        existing['_dateCreated'] = existing['_dateModified']
        del existing['_dateModified']
        revisions.append(copy.deepcopy(existing))

        # Ensure special keys starting with underscores cannot be overwritten
        for k in list(new.keys()):  # unsure if coercion needed
            if k.startswith('_'):
                del k  # log a warning?

        existing.update(new)
        existing['_dateModified'] = cur_time()
        existing['_revisions'] = revisions

        return fake_sup_det

    first = {'language': 'en', 'transcript': 'No idea'}
    second = {'language': 'fr', 'transcript': 'Ne pas idée'}

    # now call imaginary method to store first transcript
    fake_sup_det.update(first)
    # is a leading underscore a good convention for marking things that must not be set by the action result?
    # alternatively, we could nest all the action results inside some object
    # or, we could nest all the non-action-result metadata-type things inside
    # an object, and protect that from being overwritten by the action
    fake_sup_det['_dateCreated'] = fake_sup_det['_dateModified'] = cur_time()
    fake_sup_det['_revisions'] = []

    sup_det = get_supplemental_details()
    assert sup_det['language'] == 'en'
    assert sup_det['transcript'] == 'No idea'
    assert sup_det['_dateCreated'] == sup_det['_dateModified']
    assert sup_det['_revisions'] == []
    first_time = sup_det['_dateCreated']

    # now call imaginary method to store second transcript
    sup_det = revise_supplemental_details(second)

    assert len(sup_det['_revisions']) == 1

    # the revision should encompass the first transcript
    assert sup_det['_revisions'][0].items() >= first.items()

    # the revision should have a creation timestamp equal to that of the first
    # transcript
    assert sup_det['_revisions'][0]['_dateCreated'] == first_time

    # revisions should not list a modification timestamp
    assert '_dateModified' not in sup_det['_revisions']

    # the record itself (not revision) should have an unchanged creation
    # timestamp
    assert sup_det['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(
        sup_det['_dateModified']
    ) > dateutil.parser.parse(sup_det['_dateCreated'])

    # the record itself should encompass the second transcript
    assert sup_det.items() >= second.items()
