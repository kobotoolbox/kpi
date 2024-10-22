DELIMITER = '-'

BEGINNERS = ()
ENDERS = ()
for hierarchy_keyword in ['score', 'group', 'repeat']:
    BEGINNERS = BEGINNERS + (f'begin_{hierarchy_keyword}',)
    ENDERS = ENDERS + (f'end_{hierarchy_keyword}',)


def concat_xpath(name, parent_names):
    return '/'.join(
        [*parent_names, name or '']
    )


def get_name(row):
    return row.get('name',
        row.get('$autoname')
    )


def insert_full_paths_in_place(content):
    """
    insert an absolute path to each question based on parent
    groups

    the delimiter is set in the DELIMITER variable
    """
    hierarchy = []
    for row in content.get('survey', []):
        if row.get('type') in ENDERS:
            hierarchy.pop()
        else:
            rowname = get_name(row)
            if rowname is not None:
                row['$xpath'] = concat_xpath(rowname, hierarchy)
                if row.get('type') in BEGINNERS:
                    hierarchy.append(rowname)
