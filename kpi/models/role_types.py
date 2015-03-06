ROLE_TYPES = (
    ('denied', 'No access'), # Overrides inherited access
    ('viewer', 'Can view'),
    ('editor', 'Can edit'),
)

def get_role_privileges(role_type='denied'):
    ''' Given a role_type string, returns a tuple of booleans:
    (can_view, can_edit). '''
    if role_type == 'denied':
        return (False, False)
    elif role_type == 'viewer':
        return (True, False)
    elif role_type == 'editor':
        return (True, True)
    else:
        raise Exception('{} is an unknown role type.'.format(role_type))
