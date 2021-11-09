# coding: utf-8
# 😬
import copy
import sys
from collections import OrderedDict
from io import BytesIO

import six
import xlsxwriter

from formpack.utils.kobo_locking import (
    revert_kobo_lock_structure,
    strip_kobo_locking_profile,
)


class XlsExportableMixin:
    def ordered_xlsform_content(self,
                                kobo_specific_types=False,
                                append=None):
        # currently, this method depends on "FormpackXLSFormUtilsMixin"
        content = copy.deepcopy(self.content)
        if append:
            self._append(content, **append)
        self._standardize(content)
        if not kobo_specific_types:
            self._expand_kobo_qs(content)
            self._autoname(content)
            self._populate_fields_with_autofields(content)
            self._strip_kuids(content)
            revert_kobo_lock_structure(content)
        content = OrderedDict(content)
        self._xlsform_structure(
            content, ordered=True, kobo_specific=kobo_specific_types
        )
        return content

    def to_xls_io(self, versioned=False, **kwargs):
        """
        To append rows to one or more sheets, pass `append` as a
        dictionary of lists of dictionaries in the following format:
            `{'sheet name': [{'column name': 'cell value'}]}`
        Extra settings may be included as a dictionary in the same
        parameter.
            `{'settings': {'setting name': 'setting value'}}`
        """
        if versioned:
            append = kwargs.setdefault('append', {})
            append_survey = append.setdefault('survey', [])
            # We want to keep the order and append `version` at the end.
            append_settings = OrderedDict(append.setdefault('settings', {}))
            append_survey.append(
                {
                    'name': '__version__',
                    'calculation': '\'{}\''.format(self.version_id),
                    'type': 'calculate',
                }
            )
            append_settings.update(
                {
                    'version': self.version_number_and_date,
                    'form_title': self.name,
                }
            )
            kwargs['append']['settings'] = append_settings
        try:
            def _add_contents_to_sheet(sheet, contents):
                cols = []
                for row in contents:
                    for key in row.keys():
                        if key not in cols:
                            cols.append(key)
                for ci, col in enumerate(cols):
                    sheet.write(0, ci, col)
                for ri, row in enumerate(contents):
                    for ci, col in enumerate(cols):
                        val = row.get(col, None)
                        if val:
                            sheet.write(ri + 1, ci, val)

            # The extra rows and settings should persist within this function
            # and its return value *only*. Calling deepcopy() is required to
            # achieve this isolation.
            ss_dict = self.ordered_xlsform_content(**kwargs)
            output = BytesIO()
            with xlsxwriter.Workbook(output) as workbook:
                for sheet_name, contents in ss_dict.items():
                    cur_sheet = workbook.add_worksheet(sheet_name)
                    _add_contents_to_sheet(cur_sheet, contents)
        except Exception as e:
            six.reraise(
                type(e),
                type(e)(
                    "asset.content improperly formatted for XLS "
                    "export: %s" % repr(e)
                ),
                sys.exc_info()[2],
            )

        output.seek(0)
        return output
