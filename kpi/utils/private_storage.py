def superuser_or_username_matches_prefix(private_file):
    '''
    You can create a custom function, and use that instead. The function
    receives a private_storate.models.PrivateFile object, which has the
    following fields:

        request: the Django request.
        storage: the storage engine used to retrieve the file.
        relative_name: the file name in the storage.
        full_path: the full file system path.
        exists(): whether the file exists.
        content_type: the HTTP content type.

    (See https://github.com/edoburu/django-private-storage)
    '''
    request = private_file.request
    if not request.user.is_authenticated():
        return False
    if request.user.is_superuser:
        return True
    if private_file.relative_name.startswith(
        '{}/'.format(request.user.username)
    ):
        return True

    return False
