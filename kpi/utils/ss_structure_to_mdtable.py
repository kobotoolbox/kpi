from collections import defaultdict
import string

def _convert_sheets_to_lists(content):
    if isinstance(content[0], list):
        cols = set(content[0])
    else:
        cols = set()
    for row in content:
        if isinstance(row, dict):
            for key, val in row.items():
                cols.add(key)
    out_content = [list(cols)]
    for row in content:
        if isinstance(row, list):
            out_content.append(row)
        else:
            out_row = []
            for col in cols:
                out_row.append(row.get(col, ''))
            out_content.append(out_row)
    return out_content

def ss_structure_to_mdtable(content):
    """
    receives a dict or OrderedDict with arrays of arrays representing
    a spreadsheet, and returns a markdown document with tables
    """
    out_sheets = {}
    output = []

    def cell_to_str(cell):
        return '' if cell is None else unicode(cell)

    for (key, contents) in content.items():
        out_sheets[key] = output
        list_of_lists = _convert_sheets_to_lists(contents)
        for row in list_of_lists:
            output.append(['' if cell is None else unicode(cell) for cell in row])
        output = []

    def _pad_columns(sheet_arr):
        max_col = 0
        max_lens = defaultdict(int)
        for row in sheet_arr:
            if row[0] == '-':
                pass
            if len(row) > max_col:
                max_col = len(row)
            for cel_n in range(0, len(row)):
                cel_l = len(row[cel_n])
                if max_lens[cel_n] < cel_l:
                    max_lens[cel_n] = cel_l
        for row in sheet_arr:
            for noop in range(max_col - len(row)):
                row.append('')
        for row in sheet_arr:
            for cel_n in range(0, len(row)):
                row[cel_n] = string.ljust(row[cel_n], max_lens[cel_n])
        return sheet_arr
    out_strs = []
    for key, sheet in out_sheets.items():
        out_strs.append('#%s\n%s' % (key, list_to_mdtable(_pad_columns(sheet))))
    return '\n\n'.join(out_strs)

def list_to_mdtable(ll):
    outstrs = []
    for row in ll:
        outstrs.append("| %s |" % (" | ".join(row)))
    return "\n".join(outstrs)
