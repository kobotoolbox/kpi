import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from kobo.apps.subsequences.constants import GOOGLETS, GOOGLETX

ACTION_NEEDED = 'ACTION_NEEDED'
PASSES = 'PASSES'


class BaseAction:
    ID = None
    _destination_field = '_supplementalDetails'

    DATE_CREATED_FIELD = 'dateCreated'
    DATE_MODIFIED_FIELD = 'dateModified'
    DELETE = '⌫'

    def __init__(self, params):
        self.load_params(params)

    def cur_time(self):
        return datetime.datetime.now(tz=ZoneInfo('UTC')).strftime('%Y-%m-%dT%H:%M:%SZ')

    def load_params(self, params):
        raise NotImplementedError('subclass must define a load_params method')

    def run_change(self, params):
        raise NotImplementedError('subclass must define a run_change method')

    def check_submission_status(self, submission):
        return PASSES

    def modify_jsonschema(self, schema):
        return schema

    def compile_revised_record(self, content, edits):
        """
        a method that applies changes to a json structure and appends previous
        changes to a revision history
        """
        if self.ID is None:
            return content
        for field_name, vals in edits.items():
            if field_name == 'submission':
                continue

            erecord = vals.get(self.ID)
            o_keyval = content.get(field_name, {})
            for extra in [GOOGLETX, GOOGLETS]:
                if extra in vals:
                    o_keyval[extra] = vals[extra]
                    content[field_name] = o_keyval

            orecord = o_keyval.get(self.ID)
            if erecord is None:
                continue
            if self.is_auto_request(erecord):
                content[field_name].update(
                    self.auto_request_repr(erecord)
                )
                continue
            if orecord is None:
                compiled_record = self.init_field(erecord)
            elif not self.has_change(orecord, erecord):
                continue
            else:
                compiled_record = self.revise_field(orecord, erecord)
            o_keyval[self.ID] = compiled_record
            content[field_name] = o_keyval
        return content

    def auto_request_repr(self, erecord):
        raise NotImplementedError()

    def is_auto_request(self, erecord):
        return self.record_repr(erecord) == 'GOOGLE'

    def init_field(self, edit):
        edit[self.DATE_CREATED_FIELD] = \
            edit[self.DATE_MODIFIED_FIELD] = \
            str(timezone.now()).split('.')[0]
        return {**edit, 'revisions': []}

    def revise_field(self, original, edit):
        if self.record_repr(edit) == self.DELETE:
            return {}
        record = {**original}
        revisions = record.pop('revisions', [])
        if self.DATE_CREATED_FIELD in record:
            del record[self.DATE_CREATED_FIELD]
        edit[self.DATE_MODIFIED_FIELD] = \
            edit[self.DATE_CREATED_FIELD] = \
            str(timezone.now()).split('.')[0]
        if len(revisions) > 0:
            date_modified = revisions[-1].get(self.DATE_MODIFIED_FIELD)
            edit[self.DATE_CREATED_FIELD] = date_modified
        return {**edit, 'revisions': [record, *revisions]}

    def record_repr(self, record):
        return record.get('value')

    def has_change(self, original, edit):
        return self.record_repr(original) != self.record_repr(edit)

    @classmethod
    def build_params(kls, *args, **kwargs):
        raise NotImplementedError(f'{kls.__name__} has not implemented a build_params method')

    def get_xpath(self, row):
        # return the full path...
        for name_field in ['xpath', 'name', '$autoname']:
            if name_field in row:
                return row[name_field]
        return None

    def get_name(self, row):
        for name_field in ['name', '$autoname']:
            if name_field in row:
                return row[name_field]
        return None
