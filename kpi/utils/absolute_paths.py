DELIMITER = '-'
pairers = ['score', 'group', 'repeat']
BEGINNERS = map(lambda ss: f'begin_{ss}', pairers)
ENDERS = map(lambda ss: f'end_{ss}', pairers)


def concat_paths(name, parent_names):
    return DELIMITER.join(
        [*parent_names, name]
    )

def concat_xpath(name, parent_names):
    return '/'.join(
        [*parent_names, name]
    )

def get_name(row):
    return row.get('name',
        row.get('$autoname')
    )

def insert_full_paths_in_place(content):
    '''
    insert an absolute path to each question based on parent
    groups

    the delimiter is set in the DELIMITER variable
    '''
    hierarchy = []
    for row in content.get('survey', []):
        if row.get('type') in ENDERS:
            hierarchy.pop()
        else:
            rowname = get_name(row)
            # if rowname is not None:
            row['$qpath'] = concat_paths(rowname, hierarchy)
            row['$xpath'] = concat_xpath(rowname, hierarchy)
            if row.get('type') in BEGINNERS:
                hierarchy.append(get_name(row))
