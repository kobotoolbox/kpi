'''
Opens a stream (BytesIO) with XLS contents and renames
a sheet (e.g. "library") to a new name (e.g. "survey")
to get around restrictions on sheet names in pyxform
inputs
'''

from xlutils.copy import copy
from xlrd import open_workbook


def rename_xls_sheet(xls_stream, from_sheet, to_sheet):
    readable = open_workbook(file_contents=xls_stream.read())
    writable = copy(readable)
    index = readable.sheet_names().index(from_sheet)
    writable.get_sheet(index).name = to_sheet
    stream = BytesIO()
    writable.save(stream)
    stream.seek(0)
    return stream
