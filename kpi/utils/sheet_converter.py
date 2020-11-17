# coding: utf-8
import datetime
import re
from collections import OrderedDict

import xlrd
from pyxform.errors import PyXFormError
from pyxform.utils import basestring, unichr, unicode
from xlrd import XLRDError


def convert_xls_to_dict(xls_file_object, strip_empty_rows=True):
    """

    Change sheets to dict for `library` uploads to bypass pyxform's parsing
    since xls_to_dict does not like forms with `library` sheets.
    https://www.flowdock.com/app/kobotoolbox/kobo/threads/x-uUMo8M2PfHGoC04PEBcDlmKz4
    https://github.com/XLSForm/pyxform/blob/50921a8e48b853565abd48b543558b5e24d6c4f4/pyxform/constants.py#L77-L86

    """
    def _sheet_to_dict(sheet):
        result = []
        for row in range(1, sheet.nrows):
            row_dict = OrderedDict()
            for column in range(0, sheet.ncols):
                # Changing to cell_value function
                # convert to string, in case it is not string
                key = '%s' % sheet.cell_value(0, column)
                key = key.strip()
                value = sheet.cell_value(row, column)
                # remove whitespace at the beginning and end of value
                if isinstance(value, basestring):
                    value = value.strip()
                value_type = sheet.cell_type(row, column)
                if value is not None:
                    if not _iswhitespace(value):
                        row_dict[key] = _xls_value_to_unicode(
                            value, value_type
                        )
            result.append(row_dict)
        return result

    try:
        workbook = xlrd.open_workbook(file_contents=xls_file_object.read())
    except XLRDError as error:
        raise PyXFormError('Error reading .xls file: %s' % error)

    ss_structure = {}
    for sheet in workbook.sheets():
        sheet_name = sheet.name
        sheet_contents = _sheet_to_dict(sheet)
        ss_structure[sheet_name] = sheet_contents
    return ss_structure


def convert_xls_to_ss_structure(xls_file_object, strip_empty_rows=True):
    """
    The goal: Convert an XLS file object to a CSV string.

    This draws on code from `pyxform.xls2json_backends` and `convert_file_to_csv_string`, however
    this works as it is expected (does not add extra sheets or perform misc conversions which are
    a part of `pyxform.xls2json_backends.xls_to_dict`.)
    """

    def _escape_newline_chars(cell):
        return re.sub(r'\r', '\\\\r', re.sub(r'\n', '\\\\n', cell))

    def _sheet_to_lists(sheet):
        result = []
        for row in range(0, sheet.nrows):
            row_results = []
            row_empty = True
            for col in range(0, sheet.ncols):
                value = sheet.cell_value(row, col)
                if isinstance(value, str):
                    value = _escape_newline_chars(value.strip())
                if (value is not None) and (not _iswhitespace(value)):
                    value = _xls_value_to_unicode(value, sheet.cell_type(row, col))
                if value != '':
                    row_empty = False
                if value == '':
                    value = None
                row_results.append(value)
            if not strip_empty_rows or not row_empty:
                result.append(row_results)
        return result

    workbook = xlrd.open_workbook(file_contents=xls_file_object.read())
    ss_structure = {}
    for sheet in workbook.sheets():
        sheet_name = sheet.name
        sheet_contents = _sheet_to_dict(sheet)
        ss_structure[sheet_name] = sheet_contents
    return ss_structure


def _iswhitespace(string):
    return isinstance(string, str) and len(string.strip()) == 0


def _xls_value_to_unicode(value, value_type):
    """
    Take a xls formatted value and try to make a unicode string
    representation.
    """
    if value_type == xlrd.XL_CELL_BOOLEAN:
        return 'TRUE' if value else 'FALSE'
    elif value_type == xlrd.XL_CELL_NUMBER:
        # Try to display as an int if possible.
        int_value = int(value)
        if int_value == value:
            return str(int_value)
        else:
            return str(value)
    elif value_type is xlrd.XL_CELL_DATE:
        # Warn that it is better to single quote as a string.
        # error_location = cellFormatString % (ss_row_idx, ss_col_idx)
        # raise Exception(
        #   'Cannot handle excel formatted date at ' + error_location)
        datetime_or_time_only = xlrd.xldate_as_tuple(
            value, workbook.datemode)
        if datetime_or_time_only[:3] == (0, 0, 0):
            # must be time only
            return str(datetime.time(*datetime_or_time_only[3:]))
        return str(datetime.datetime(*datetime_or_time_only))
    else:
        # ensure unicode and replace nbsp spaces with normal ones
        # to avoid this issue:
        # https://github.com/modilabs/pyxform/issues/83
        return str(value).replace(chr(160), ' ')

