import os
from mimetypes import guess_type

from django.core.files.base import ContentFile


class ExtendedContentFile(ContentFile):

    @property
    def content_type(self):
        mimetype, _ = guess_type(os.path.basename(self.name))
        return mimetype
