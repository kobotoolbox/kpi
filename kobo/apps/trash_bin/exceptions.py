class TrashIntegrityError(Exception):
    pass


class TrashKobocatNotResponsiveError(Exception):

    def __init__(self, *args, **kwargs):
        super().__init__('Could not communicate with KoBoCAT.', *args, **kwargs)


class TrashTaskInProgressError(Exception):
    pass


class TrashNotImplementedError(NotImplementedError):
    pass
