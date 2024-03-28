# coding: utf-8
from django.utils.translation import gettext as t


class DuplicateUUIDError(Exception):
    pass


class FormInactiveError(Exception):
    pass


class TemporarilyUnavailableError(Exception):
    pass
