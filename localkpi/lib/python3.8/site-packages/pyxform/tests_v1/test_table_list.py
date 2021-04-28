# -*- coding: utf-8 -*-
"""
Test table list appearance syntax.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase

MD = '''
| survey  |                    |            |           |            |                   |
|         | type               | name       | label     | hint       |appearance         |
|         | begin_group        | tablelist1 | Table_Y_N |            |table-list minimal |
|         | select_one yes_no  | options1a  | Q1        | first row! |                   |
|         | select_one yes_no  | options1b  | Q2        |            |                   |
|         | end_group          |            |           |            |                   |
| choices |                    |            |           |            |                   |
|         | list_name          | name       | label     |            |                   |
|         | yes_no             | yes        | Yes       |            |                   |
0            """  # noqa
'''  # nopep8

XML_CONTAINS = """
    <group appearance="field-list minimal" ref="/table-list-appearance-mod/tablelist1">
      <input ref="/table-list-appearance-mod/tablelist1/generated_table_list_label_2">
        <label>Table_Y_N</label>
      </input>
      <select1 appearance="label" ref="/table-list-appearance-mod/tablelist1/reserved_name_for_field_list_labels_3">
        <label> </label>
        <item>
          <label>Yes</label>
          <value>yes</value>
        </item>
      </select1>
      <select1 appearance="list-nolabel" ref="/table-list-appearance-mod/tablelist1/options1a">
        <label>Q1</label>
        <hint>first row!</hint>
""".strip()  # nopep8


class TableListTest(PyxformTestCase):
    def test_table_list(self):
        self.assertPyxformXform(
            name="table-list-appearance-mod",
            md=MD,
            xml__contains=[XML_CONTAINS],
            debug=False,
        )
