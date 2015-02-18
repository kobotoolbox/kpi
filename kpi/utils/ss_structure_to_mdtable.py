from collections import defaultdict
import string

def ss_structure_to_mdtable(content):
    """
    receives a dict or OrderedDict with arrays of arrays representing
    a spreadsheet, and returns a markdown table
    """
    output = []
    def cell_to_str(cell):
        if cell is None:
            return ''
        else:
            return str(cell)
    for (key, contents) in content.items():
        output.append([key])
        for row in contents:
            output.append([''] + [cell_to_str(xx) for xx in row])
    max_col = 0
    max_lens = defaultdict(int)
    for row in output:
        if row[0] == '-':
            pass
        if len(row) > max_col:
            max_col = len(row)
        for cel_n in range(0, len(row)):
            cel_l = len(row[cel_n])
            if max_lens[cel_n] < cel_l:
                max_lens[cel_n] = cel_l

    for row in output:
        for noop in range(max_col - len(row)):
            row.append('')
    for row in output:
        for cel_n in range(0, len(row)):
            row[cel_n] = string.ljust(row[cel_n], max_lens[cel_n])
    return list_to_mdtable(output)

def list_to_mdtable(ll):
    outstrs = []
    for row in ll:
        outstrs.append("| %s |" % (" | ".join(row)))
    return "\n".join(outstrs)
