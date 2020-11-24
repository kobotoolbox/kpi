# coding: utf-8


class LazyFile:
    """
    Copied over from https://github.com/kobotoolbox/xls-import/blob/master/post.py#L22-L30
    to handle xlm file uploads to kobocat from `kobocat_backend.py`
    """
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode

    def read(self):
        with open(self.filename, self.mode) as f:
            return f.read()
