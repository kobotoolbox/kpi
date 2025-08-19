import mimetypes
import os

# from mimetypes import guess_type
from django.core.files.base import ContentFile


class ExtendedContentFile(ContentFile):

    def __init__(self, content, name=None, *args, **kwargs):
        super().__init__(content, name)
        self._mimetype = kwargs.get('mimetype')

    @property
    def content_type(self):
        if not (mimetype := self._mimetype):
            mimetype, _ = mimetypes.guess_type(os.path.basename(self.name))
        return mimetype
