# coding: utf-8


class LazyFile:
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode

    def read(self):
        with open(self.filename, self.mode) as f:
            return f.read()
