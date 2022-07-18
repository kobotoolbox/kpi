DELIMITER = '-'

def concat_paths(name, parent_names):
    return DELIMITER.join(
        [*parent_names, name]
    )

def insert_qpath_in_place(content):
    '''
    insert an absolute path to each question based on parent
    groups

    the delimiter will be configurable
    '''
    pass
