from kobo.apps.subsequences.constants import GOOGLETS
from ..constants import TRANSCRIBABLE_SOURCE_TYPES
from ..actions.base import BaseAction, ACTION_NEEDED, PASSES

NOT_REQUESTED = 'NOT_REQUESTED'
REQUESTED_BY_USER = 'REQUESTED_BY_USER'
PENDING = 'PENDING'


DT_MOD = BaseAction.DATE_MODIFIED_FIELD
DT_CREATED = BaseAction.DATE_CREATED_FIELD


class AutomaticTranscriptionAction(BaseAction):
    ID = 'transcript'
    MANUAL = 'user_transcribed'

    @classmethod
    def build_params(cls, params, content):
        possible_transcribed_fields = []
        for row in content.get('survey', []):
            if row['type'] in TRANSCRIBABLE_SOURCE_TYPES:
                possible_transcribed_fields.append(cls.get_xpath(cls, row))
        params = {'values': possible_transcribed_fields, 'services': []}
        return params

    @classmethod
    def get_values_for_content(cls, content):
        possible_transcribed_fields = []
        for row in content.get('survey', []):
            if row['type'] in TRANSCRIBABLE_SOURCE_TYPES:
                possible_transcribed_fields.append(cls.get_xpath(cls, row))
        return possible_transcribed_fields

    def load_params(self, params):
        self.possible_transcribed_fields = params.get('values', [])
        self.available_services = params.get('services', [])
        self.languages = params.get('languages', [])

    def modify_jsonschema(self, schema):
        defs = schema.get('definitions', {})
        defs['transcript'] = {
            'type': 'object',
            'properties': {
                'value': {'type': 'string'},
                'engine': {'type': 'string'},
                self.DATE_CREATED_FIELD: {'type': 'string',
                                          'format': 'date-time'},
                self.DATE_MODIFIED_FIELD: {'type': 'string',
                                           'format': 'date-time'},
                'languageCode': {'type': 'string'},
                'regionCode': {'type': 'string'},
                'revisions': {'type': 'array', 'items': {
                    '$ref': '#/definitions/transcriptRevision'
                }}
            },
            'additionalProperties': False,
            'required': ['value'],
        }
        defs['transcriptRevision'] = {
            'type': 'object',
            'properties': {
                'value': {'type': 'string'},
                'engine': {'type': 'string'},
                self.DATE_MODIFIED_FIELD: {'type': 'string',
                                           'format': 'date-time'},
                'languageCode': {'type': 'string'},
            },
            'additionalProperties': False,
            'required': ['value'],
        }
        defs['_googlets'] = {
            'type': 'object',
            'properties': {
                'status': {'enum': ['requested', 'in_progress', 'complete', 'error']},
                'responseJSON': {
                    'type': 'object',
                    'properties': {
                        'error': {'type': 'string'},
                        'detail': {'type': 'string'},
                    }
                },
            }
        }
        for field in self.possible_transcribed_fields:
            field_def = schema['properties'].get(field, {
                'type': 'object',
                'properties': {},
                'additionalProperties': False,
            })
            field_def['properties'][self.ID] = {
                '$ref': '#/definitions/transcript'
            }
            field_def['properties'][GOOGLETS] = {
                '$ref': '#/definitions/_googlets',
            }
            schema['properties'][field] = field_def
        schema['definitions'] = defs
        return schema

    def check_submission_status(self, submission):
        if self._destination_field not in submission:
            return ACTION_NEEDED
        return PASSES

    def addl_fields(self):
        service = 'manual'
        for field in self.possible_transcribed_fields:
            label = f'{field} - transcript'
            _type = 'transcript'
            yield {
                'type': _type,
                'name': f'{field}/{_type}',
                'label': label,
                'languages': self.languages,
                'path': [field, _type],
                'source': field,
                'settings': {
                    'mode': 'auto',
                    'engine': f'engines/transcript_{service}',
                },
            }

    """
    {"value": "My translation", "languageCode": "en", "date": "12today"}

    AQ1 Translation (FR)	AQ1 Translation (XZ)
    --------------------    --------------------
    "My translation"
    """

    def engines(self):
        manual_name = f'engines/transcript_manual'
        manual_engine = {
            'details': 'A human provided transcription'
        }
        yield (manual_name, manual_engine)
        for service in self.available_services:
            name = f'engines/transcript_{service}'
            yield (name, {
                'description': f'Transcription by {service}'
            })

    def field_service_matrix(self):
        for field in self.possible_transcribed_fields:
            yield (field,
                   'manual',
                   f'{field}_transcription_manual')
            for service in self.available_services:
                fs_key = f'{field}_transcription_{service}'
                yield (field, service, fs_key)

    def run_change(self, submission):
        pass

    def auto_request_repr(self, erecord):
        return {
            GOOGLETS: {
                'status': 'requested',
                'languageCode': erecord['languageCode'],
            }
        }
