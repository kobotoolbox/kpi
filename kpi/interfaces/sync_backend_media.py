# coding: utf-8

class SyncBackendMediaInterface:
    """
    This interface defines required properties and methods
    of objects passed to deployment back-end class on media synchronization.

    """

    @property
    def backend_data_value(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def backend_uniqid(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    def delete(self, **kwargs):
        raise NotImplementedError('This method should be implemented in '
                                  'subclasses')

    @property
    def deleted_at(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def filename(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def hash(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def is_remote_url(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def mimetype(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')
