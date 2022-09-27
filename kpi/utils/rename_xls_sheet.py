from io import BytesIO

import openpyxl
from xlutils.copy import copy
from xlrd import open_workbook


class NoFromSheetError(Exception):
    pass


class ConflictSheetError(ValueError):
    pass


def rename_xls_sheet(
    xls_stream: BytesIO, from_sheet: str, to_sheet: str
) -> BytesIO:
    """
    Opens a stream (BytesIO) with XLS contents and renames a sheet (e.g.
    "library") to a new name (e.g. "survey") to get around restrictions on
    sheet names in pyxform inputs;
    see https://github.com/XLSForm/pyxform/issues/229.
    """
    readable = open_workbook(file_contents=xls_stream.read())
    writable = copy(readable)
    sheet_names = readable.sheet_names()
    if from_sheet in sheet_names and to_sheet in sheet_names:
        raise ConflictSheetError()
    if from_sheet not in sheet_names:
        raise NoFromSheetError(from_sheet)
    index = sheet_names.index(from_sheet)
    writable.get_sheet(index).name = to_sheet
    stream = BytesIO()
    writable.save(stream)
    stream.seek(0)
    return stream


def rename_xlsx_sheet(
    xls_stream: BytesIO, from_sheet: str, to_sheet: str
) -> BytesIO:
    book = openpyxl.load_workbook(xls_stream)
    sheet_names = book.sheetnames
    if from_sheet in sheet_names and to_sheet in sheet_names:
        raise ConflictSheetError()
    if from_sheet not in sheet_names:
        raise NoFromSheetError(from_sheet)
    book[from_sheet].title = to_sheet
    stream = BytesIO()
    writable.save(stream)
    stream.seek(0)
    return stream
