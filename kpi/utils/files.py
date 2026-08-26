import mimetypes
import os
import unicodedata

# from mimetypes import guess_type
from django.core.files.base import ContentFile


class ExtendedContentFile(ContentFile):

    def __init__(self, content, name=None, *args, **kwargs):
        super().__init__(content, name)
        self._mimetype = kwargs.get('mimetype')
        self._raw_filename = os.path.basename(name) if name else None

    @property
    def content_type(self):
        if not (mimetype := self._mimetype):
            mimetype, _ = mimetypes.guess_type(os.path.basename(self.name))
        return mimetype


def normalize_nfc(value: str | None) -> str | None:
    """
    Return the NFC-normalized form of a string.

    Filenames can reach the server in different unicode normalization forms
    (e.g. macOS produces NFD combining marks), which breaks byte-exact
    matching. Pass through None/empty values unchanged.
    """
    if not value:
        return value
    return unicodedata.normalize('NFC', value)
