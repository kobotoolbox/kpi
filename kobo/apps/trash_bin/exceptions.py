class TrashIntegrityError(Exception):
    pass


class TrashKobocatNotResponsiveError(Exception):

    def __init__(self, *args, **kwargs):
        super().__init__('Could not communicate with KoBoCAT.', *args, **kwargs)


class TrashNotImplementedError(NotImplementedError):
    pass


class TrashMongoDeleteOrphansError(Exception):
    def __init__(self, *args, **kwargs):
        super().__init__(
            'Could not delete all orphan submissions in MongoDB',
            *args,
            **kwargs
        )


class TrashTaskInProgressError(Exception):
    pass


class TrashUnknownKobocatError(Exception):
    def __init__(self, *args, **kwargs):
        response = kwargs.pop('response', {})
        if 'data' in response and 'detail' in response['data']:
            message = response['data']['detail']
        super().__init__(message, *args, **kwargs)
