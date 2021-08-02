# coding: utf-8
from collections import OrderedDict


def _convert_sheets_to_lists(content):
    cols = OrderedDict()
    if not content or len(content) == 0:
        return [], None
    if isinstance(content[0], list):
        cols.update(OrderedDict.fromkeys(content[0]))
    for row in content:
        if isinstance(row, dict):
            cols.update(OrderedDict.fromkeys(row.keys()))
    cols = cols.keys()
    out_content = []
    _valid = False
    for row in content:
        out_row = []
        for col in cols:
            _val = row.get(col, '')
            if _val is None:
                _val = ''
            out_row.append(_val)
        if len(out_row) > 0:
            _valid = True
        out_content.append(out_row)
    return cols, out_content if _valid else None


def ss_structure_to_mdtable(content):
    """
    receives a dict or OrderedDict with arrays of arrays representing
    a spreadsheet, and returns a markdown document with tables
    """
    import tabulate
    out_sheets = OrderedDict()
    output = []

    def cell_to_str(cell):
        return '' if cell is None else str(cell)

    for (sheet_name, contents) in content.items():
        out_sheets[sheet_name] = output
        (headers, content) = _convert_sheets_to_lists(contents)
        if content:
            output.append('#{}'.format(sheet_name))
            output.append(tabulate.tabulate(content,
                                            headers=headers,
                                            tablefmt="orgtbl"))
    return '\n\n'.join(output)
