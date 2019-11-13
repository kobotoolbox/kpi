# coding: utf-8
# 😬


class RowHandler:

    def handle_row(self, row):
        """
        handle_row(row) should return False to return to the base handler
        """
        raise NotImplementedError("RowHandler.handle_row"
                                  " must be overridden by subclass")


class BaseHandler(RowHandler):
    _base_handler = False

    def __init__(self, other_sheets={}):
        self.survey_contents = []
        self.other_sheets = other_sheets

    def handle_row(self, row):
        self.survey_contents.append(row)
        return self

    def choices(self, list_name):
        for choice in self.other_sheets.get('choices', []):
            if choice['list_name'] == list_name:
                yield choice


class GroupHandler(RowHandler):
    def __init__(self, base_handler):
        self._base_handler = base_handler

    def begin(self, initial_row):
        self._rows = []
        self.initial_row_type = initial_row.get('type')
        self.name_key = 'name' if ('name' in initial_row) else '$autoname'
        self.name = initial_row[self.name_key]

    def finish(self):
        survey_contents = self._base_handler.survey_contents
        for row in self._rows:
            survey_contents.append(row)
