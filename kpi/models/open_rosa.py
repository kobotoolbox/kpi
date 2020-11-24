# coding: utf-8

class AbstractOpenRosaFormListModel:

    @property
    def description(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def form_id(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    def get_download_url(self, request):
        raise NotImplementedError('This method should be implemented in '
                                  'subclasses')

    def get_manifest_url(self, request):
        raise NotImplementedError('This method should be implemented in '
                                  'subclasses')

    @property
    def hash(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    @property
    def name(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')


class AbstractOpenRosaManifestModel:

    @property
    def filename(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

    def get_download_url(self, request):
        raise NotImplementedError('This method should be implemented in '
                                  'subclasses')

    @property
    def hash(self):
        raise NotImplementedError('This property should be implemented in '
                                  'subclasses')

