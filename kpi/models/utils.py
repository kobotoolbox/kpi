# coding: utf-8
from abc import ABC

from django.db import models


class DjangoModelABCMetaclass(type(models.Model), type(ABC)):
    """
    This metaclass combines Django Model meta class and ABC meta class.
    Needed to be passed as the meta class for classes that inherit from the
    two others.
    """
    pass
