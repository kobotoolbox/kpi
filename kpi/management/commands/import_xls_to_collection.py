from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.conf import settings
import StringIO
import tempfile
import pyxform
import urllib
import json
import xlrd
import csv
import sys
import re

def convert_xls_to_ss_structure(xls_file_object, strip_empty_rows=True):
    """
    The goal: Convert an XLS file object to a CSV string.

    This draws on code from `pyxform.xls2json_backends` and `convert_file_to_csv_string`, however
    this works as it is expected (does not add extra sheets or perform misc conversions which are
    a part of `pyxform.xls2json_backends.xls_to_dict`.)
    """
    def _iswhitespace(string):
        return isinstance(string, basestring) and len(string.strip()) == 0

    def xls_value_to_unicode(value, value_type):
        """
        Take a xls formatted value and try to make a unicode string
        representation.
        """
        if value_type == xlrd.XL_CELL_BOOLEAN:
            return u"TRUE" if value else u"FALSE"
        elif value_type == xlrd.XL_CELL_NUMBER:
            #Try to display as an int if possible.
            int_value = int(value)
            if int_value == value:
                return unicode(int_value)
            else:
                return unicode(value)
        elif value_type is xlrd.XL_CELL_DATE:
            #Warn that it is better to single quote as a string.
            #error_location = cellFormatString % (ss_row_idx, ss_col_idx)
            #raise Exception(
            #   "Cannot handle excel formatted date at " + error_location)
            datetime_or_time_only = xlrd.xldate_as_tuple(
                value, workbook.datemode)
            if datetime_or_time_only[:3] == (0, 0, 0):
                # must be time only
                return unicode(datetime.time(*datetime_or_time_only[3:]))
            return unicode(datetime.datetime(*datetime_or_time_only))
        else:
            #ensure unicode and replace nbsp spaces with normal ones
            #to avoid this issue:
            #https://github.com/modilabs/pyxform/issues/83
            return unicode(value).replace(unichr(160), ' ')

    def _escape_newline_chars(cell):
        return re.sub(r'\r', '\\\\r', re.sub(r'\n', '\\\\n', cell))

    def _sheet_to_lists(sheet):
        result = []
        for row in range(0, sheet.nrows):
            row_results = []
            row_empty = True
            for col in range(0, sheet.ncols):
                value = sheet.cell_value(row, col)
                if isinstance(value, basestring):
                    value = _escape_newline_chars(value.strip())
                if (value is not None) and (not _iswhitespace(value)):
                    value = xls_value_to_unicode(value, sheet.cell_type(row, col))
                if value != "":
                    row_empty = False
                if value == "":
                    value = None
                row_results.append(value)
            if not strip_empty_rows or not row_empty:
                result.append(row_results)
        return result

    workbook = xlrd.open_workbook(file_contents=xls_file_object.read())
    ss_structure = {}
    for sheet in workbook.sheets():
        sheet_name = sheet.name
        sheet_contents = _sheet_to_lists(sheet)
        ss_structure[sheet_name] = sheet_contents
    return ss_structure

class Command(BaseCommand):
    def handle(self, *args, **options):
        username = args[0]
        filename = args[1]
        user = User.objects.get(username=username)
        with open(filename, 'rb') as ff:
            contents = convert_xlsto_ss_structure(ff)
        library = contents.get('library')
        choices = contents.get('choices')
        cols = library[0]
        rows = []
        for row in library[1:]:
            rows.append(dict(zip(cols, row)))
        colls = user.collections.filter(name=filename)
        for coll in colls:
            coll.delete()
        assets = []
        for row in rows:
            assets.append({
                    'name': 'imported asset',
                    'content': {
                        'choices': choices,
                        'survey': [row],
                    },
                })
        new_library = user.collections.create(name=filename, survey_assets=assets)
