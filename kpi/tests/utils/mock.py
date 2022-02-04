# coding: utf-8
import os
from mimetypes import guess_type

from django.core.files import File


class MockAttachment:
    """
    Mock object to simulate ReadOnlyKobocatAttachment.
    Relationship with ReadOnlyKobocatInstance is ignored but could be implemented
    """
    def __init__(self, file_):
        self.media_file = File(open(file_, 'rb'), os.path.basename(file_))
        self.media_file.path = file_
        self.media_file_basename = os.path.basename(file_)
        self.mimetype, _ = guess_type(file_)

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.media_file.close()
