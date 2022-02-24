# coding: utf-8
import os
from mimetypes import guess_type
from tempfile import NamedTemporaryFile
from typing import Optional

from django.core.files import File

from kpi.mixins.audio_converter import ConverterMixin


class MockAttachment(ConverterMixin):
    """
    Mock object to simulate ReadOnlyKobocatAttachment.
    Relationship with ReadOnlyKobocatInstance is ignored but could be implemented
    """
    def __init__(self, file_):
        self.media_file = File(open(file_, 'rb'), os.path.basename(file_))
        self.media_file.path = file_
        self.media_file_basename = os.path.basename(file_)
        self.mimetype, _ = guess_type(file_)
        self.content = self.media_file.read()
        self.media_file.close()

    @property
    def absolute_path(self):
        return self.media_file.path

    def protected_path(self, format_: Optional[str] = None):
        if format_ in self.AVAILABLE_CONVERSIONS:
            suffix = f'.{format_}'
            with NamedTemporaryFile(suffix=suffix) as f:
                self.content = self.get_converter_content(format_)
            return f.name
        else:
            return self.absolute_path
