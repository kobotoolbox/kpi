# -*- coding: utf-8 -*-
"""
XLS-to-dict and csv-to-dict are essentially backends for xls2json.
"""
import datetime
import re
from collections import OrderedDict
from functools import reduce
from io import BytesIO

import unicodecsv as csv
import xlrd
from xlrd import XLRDError
from xlrd.xldate import XLDateAmbiguous

from pyxform import constants
from pyxform.errors import PyXFormError
from pyxform.utils import basestring, unichr, unicode

XL_DATE_AMBIGOUS_MSG = (
    "The xls file provided has an invalid date on the %s sheet, under"
    " the %s column on row number %s"
)


def _list_to_dict_list(list_items):
    """
    Takes a list and creates a dict with the list values as keys.
    Returns a list of the created dict or an empty list
    """
    if list_items:
        k = OrderedDict()
        for item in list_items:
            k["%s" % item] = ""
        return [k]
    return []


def xls_to_dict(path_or_file):
    """
    Return a Python dictionary with a key for each worksheet
    name. For each sheet there is a list of dictionaries, each
    dictionary corresponds to a single row in the worksheet. A
    dictionary has keys taken from the column headers and values
    equal to the cell value for that row and column.
    All the keys and leaf elements are unicode text.
    """
    try:
        if isinstance(path_or_file, basestring):
            workbook = xlrd.open_workbook(filename=path_or_file)
        else:
            workbook = xlrd.open_workbook(file_contents=path_or_file.read())
    except XLRDError as error:
        raise PyXFormError("Error reading .xls file: %s" % error)

    def xls_to_dict_normal_sheet(sheet):
        def iswhitespace(string):
            return isinstance(string, basestring) and len(string.strip()) == 0

        # Check for duplicate column headers
        column_header_list = list()
        for column in range(0, sheet.ncols):
            column_header = sheet.cell_value(0, column)
            if column_header in column_header_list:
                raise PyXFormError("Duplicate column header: %s" % column_header)
            # xls file with 3 columns mostly have a 3 more columns that are
            # blank by default or something, skip during check
            if column_header is not None:
                if not iswhitespace(column_header):
                    # strip whitespaces from the header
                    clean_header = re.sub(r"( )+", " ", column_header.strip())
                    column_header_list.append(clean_header)

        result = []
        for row in range(1, sheet.nrows):
            row_dict = OrderedDict()
            for column in range(0, sheet.ncols):
                # Changing to cell_value function
                # convert to string, in case it is not string
                key = "%s" % sheet.cell_value(0, column)
                key = key.strip()
                value = sheet.cell_value(row, column)
                # remove whitespace at the beginning and end of value
                if isinstance(value, basestring):
                    value = value.strip()
                value_type = sheet.cell_type(row, column)
                if value is not None:
                    if not iswhitespace(value):
                        try:
                            row_dict[key] = xls_value_to_unicode(
                                value, value_type, workbook.datemode
                            )
                        except XLDateAmbiguous:
                            raise PyXFormError(
                                XL_DATE_AMBIGOUS_MSG % (sheet.name, column_header, row)
                            )
                # Taking this condition out so I can get accurate row numbers.
                # TODO: Do the same for csvs
                # if row_dict != {}:
            result.append(row_dict)
        return result, _list_to_dict_list(column_header_list)

    def xls_value_from_sheet(sheet, row, column):
        value = sheet.cell_value(row, column)
        value_type = sheet.cell_type(row, column)
        if value is not None and value != "":
            try:
                return xls_value_to_unicode(value, value_type, workbook.datemode)
            except XLDateAmbiguous:
                raise PyXFormError(XL_DATE_AMBIGOUS_MSG % (sheet.name, column, row))
        else:
            raise PyXFormError("Empty Value")

    def _xls_to_dict_cascade_sheet(sheet):
        result = []
        rs_dict = OrderedDict()  # tmp dict to hold entire structure

        def slugify(s):
            return re.sub(r"\W+", "_", s.strip().lower())

        prefix = "$PREFIX$"
        # get col headers and position first, ignore first column
        for column in range(1, sheet.ncols):
            col_name = sheet.cell_value(0, column)
            rs_dict[col_name] = {
                "pos": column,
                "data": [],
                "itemset": col_name,
                "type": constants.SELECT_ONE,
                "name": prefix
                if (column == sheet.ncols - 1)
                else "".join([prefix, "_", col_name]),
                "label": sheet.cell_value(1, column),
            }
            if column > 1:
                rs_dict[col_name]["parent"] = sheet.cell_value(0, column - 1)
            else:
                rs_dict[col_name]["choices"] = []
            choice_filter = ""
            for a in range(1, column):
                prev_col_name = sheet.cell_value(0, a)
                if choice_filter != "":
                    choice_filter += " and %s=${%s_%s}" % (
                        prev_col_name,
                        prefix,
                        prev_col_name,
                    )
                else:
                    choice_filter += "%s=${%s_%s}" % (
                        prev_col_name,
                        prefix,
                        prev_col_name,
                    )
            rs_dict[col_name]["choice_filter"] = choice_filter
        # get data, use new cascade dict structure, data starts on 3 row
        for row in range(2, sheet.nrows):
            # go through each header aka column
            for col_name in rs_dict:
                column = rs_dict[col_name]["pos"]
                cell_data = xls_value_from_sheet(sheet, row, column)
                try:
                    rs_dict[col_name]["data"].index(slugify(cell_data))
                except ValueError:
                    rs_dict[col_name]["data"].append(slugify(cell_data))
                    if "choices" in rs_dict[col_name]:
                        rs_dict[col_name]["choices"].append(
                            {"name": slugify(cell_data), "label": cell_data}
                        )
                data = {
                    "name": slugify(cell_data),
                    "label": cell_data.strip(),
                    constants.LIST_NAME: col_name,
                }
                for prev_column in range(1, column):
                    prev_col_name = sheet.cell_value(0, prev_column)
                    data[prev_col_name] = slugify(
                        xls_value_from_sheet(sheet, row, prev_column)
                    )
                result.append(data)
        # order
        kl = []
        for column in range(1, sheet.ncols):
            col_name = sheet.cell_value(0, column)
            if "parent" in rs_dict[col_name]:
                rs_dict[col_name].pop("parent")
            if "pos" in rs_dict[col_name]:
                rs_dict[col_name].pop("pos")
            if "data" in rs_dict[col_name]:
                rs_dict[col_name].pop("data")
            kl.append(rs_dict[col_name])

            # create list with no duplicates
        choices = []
        for rec in result:
            c = 0
            for check in result:
                if rec == check:
                    c += 1
            if c == 1:
                choices.append(rec)
            else:
                try:
                    choices.index(rec)
                except ValueError:
                    choices.append(rec)
        return [{"choices": choices, "questions": kl}]

    result = OrderedDict()
    for sheet in workbook.sheets():
        # Do not process sheets that have nothing to do with XLSForm.
        if sheet.name not in constants.SUPPORTED_SHEET_NAMES:
            continue
        if sheet.name == constants.CASCADING_CHOICES:
            result[sheet.name] = _xls_to_dict_cascade_sheet(sheet)
        else:
            result[sheet.name], result[
                "%s_header" % sheet.name
            ] = xls_to_dict_normal_sheet(sheet)

    return result


def xls_value_to_unicode(value, value_type, datemode):
    """
    Take a xls formatted value and try to make a unicode string
    representation.
    """
    if value_type == xlrd.XL_CELL_BOOLEAN:
        return "TRUE" if value else "FALSE"
    elif value_type == xlrd.XL_CELL_NUMBER:
        # Try to display as an int if possible.
        int_value = int(value)
        if int_value == value:
            return unicode(int_value)
        else:
            return unicode(value)
    elif value_type is xlrd.XL_CELL_DATE:
        # Warn that it is better to single quote as a string.
        # error_location = cellFormatString % (ss_row_idx, ss_col_idx)
        # raise Exception(
        #   "Cannot handle excel formatted date at " + error_location)
        datetime_or_time_only = xlrd.xldate_as_tuple(value, datemode)
        if datetime_or_time_only[:3] == (0, 0, 0):
            # must be time only
            return unicode(datetime.time(*datetime_or_time_only[3:]))
        return unicode(datetime.datetime(*datetime_or_time_only))
    else:
        # ensure unicode and replace nbsp spaces with normal ones
        # to avoid this issue:
        # https://github.com/modilabs/pyxform/issues/83
        return unicode(value).replace(unichr(160), " ")


def get_cascading_json(sheet_list, prefix, level):
    return_list = []
    for row in sheet_list:
        if "stopper" in row:
            if row["stopper"] == level:
                # last element's name IS the prefix; doesn't need level
                return_list[-1]["name"] = prefix
                return return_list
            else:
                continue
        elif "lambda" in row:

            def replace_prefix(d, prefix):
                for k, v in d.items():
                    if isinstance(v, basestring):
                        d[k] = v.replace("$PREFIX$", prefix)
                    elif isinstance(v, dict):
                        d[k] = replace_prefix(v, prefix)
                    elif isinstance(v, list):
                        d[k] = map(lambda x: replace_prefix(x, prefix), v)
                return d

            return_list.append(replace_prefix(row["lambda"], prefix))
    raise PyXFormError(
        "Found a cascading_select "
        + level
        + ", but could not find "
        + level
        + "in cascades sheet."
    )


def csv_to_dict(path_or_file):
    if isinstance(path_or_file, basestring):
        csv_data = open(path_or_file, "rb")
    else:
        csv_data = path_or_file

    _dict = OrderedDict()

    def first_column_as_sheet_name(row):
        if len(row) == 0:
            return None, None
        elif len(row) == 1:
            return row[0], None
        else:
            s_or_c = row[0]
            content = row[1:]
            if s_or_c == "":
                s_or_c = None
            # concatenate all the strings in content
            if reduce(lambda x, y: x + y, content) == "":
                # content is a list of empty strings
                content = None
            return s_or_c, content

    reader = csv.reader(csv_data, encoding="utf-8")
    sheet_name = None
    current_headers = None
    for row in reader:
        survey_or_choices, content = first_column_as_sheet_name(row)
        if survey_or_choices is not None:
            sheet_name = survey_or_choices
            if sheet_name not in _dict:
                _dict[unicode(sheet_name)] = []
            current_headers = None
        if content is not None:
            if current_headers is None:
                current_headers = content
                _dict["%s_header" % sheet_name] = _list_to_dict_list(current_headers)
            else:
                _d = OrderedDict()
                for key, val in zip(current_headers, content):
                    if val != "":
                        # Slight modification so values are striped
                        # this is because csvs often spaces following commas
                        # (but the csv reader might already handle that.)
                        _d[unicode(key)] = unicode(val.strip())
                _dict[sheet_name].append(_d)
    csv_data.close()
    return _dict


"""
I want the ability to go:

    xls => csv
so that we can go:
    xls => csv => survey

and some day:
    csv => xls

"""


def convert_file_to_csv_string(path):
    """
    This will open a csv or xls file and return a CSV in the format:
        sheet_name1
        ,col1,col2
        ,r1c1,r1c2
        ,r2c1,r2c2
        sheet_name2
        ,col1,col2
        ,r1c1,r1c2
        ,r2c1,r2c2

    Currently, it processes csv files and xls files to ensure consistent
    csv delimiters, etc. for tests.
    """
    if path.endswith(".csv"):
        imported_sheets = csv_to_dict(path)
    else:
        imported_sheets = xls_to_dict(path)
    foo = BytesIO()
    writer = csv.writer(foo, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL)
    for sheet_name, rows in imported_sheets.items():
        writer.writerow([sheet_name])
        out_keys = []
        out_rows = []
        for row in rows:
            out_row = []
            for key in row.keys():
                if key not in out_keys:
                    out_keys.append(key)
            for out_key in out_keys:
                out_row.append(row.get(out_key, None))
            out_rows.append(out_row)
        writer.writerow([None] + out_keys)
        for out_row in out_rows:
            writer.writerow([None] + out_row)
    return foo.getvalue().decode("utf-8")
