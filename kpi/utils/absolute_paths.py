DELIMITER = '-'

def concat_paths(name, parent_names):
    return DELIMITER.join(
        [*parent_names, name]
    )

def get_name(row):
    return row.get('name',
        row.get('$autoname')
    )

def insert_qpath_in_place(content):
    '''
    insert an absolute path to each question based on parent
    groups

    the delimiter is set in the DELIMITER variable
    '''
    hierarchy = []
    for row in content.get('survey', []):
        if row.get('type') == 'end_group':
            hierarchy.pop()
        else:
            rowname = get_name(row)
            row['$qpath'] = concat_paths(rowname, hierarchy)
            if row.get('type') == 'begin_group':
                hierarchy.append(get_name(row))
