from jsonschema import validate

from .draft_form_schema import DRAFT_FORM_SCHEMA as pyxformschema


def validate_content(content):
    _valid = [True, '']
    try:
        validate(content, pyxformschema)
    except Exception as err:
        message = '{}: {}'.format(str(err.absolute_path), str(err.args))
        _valid = [False, message]
    return _valid
