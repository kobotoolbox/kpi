# coding: utf-8
import os
from tempfile import NamedTemporaryFile
from mimetypes import guess_type

from django.core.files import File

from kpi.mixins.audio_converter import AudioConverterMixin


class MockAttachment(AudioConverterMixin):
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
    def path(self):
        return self.media_file.path

    def protected_path(self, format_):
        if format_ == self.CONVERSION_AUDIO_FORMAT:
            suffix = f'.{self.CONVERSION_AUDIO_FORMAT}'
            with NamedTemporaryFile(suffix=suffix) as f:
                self.content = self.get_converted_audio(self.path)
            return f.name
        else:
            return self.path
