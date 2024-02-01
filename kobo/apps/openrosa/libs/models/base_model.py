# coding: utf-8
import logging

from django.db import models


class BaseModel(models.Model):
    class Meta:
        abstract = True

    def reload(self):
        """
        Alias of `refresh_from_db()`.
        Deprecated.
        """
        logging.warning('Deprecated method. Use `refresh_from_db()` instead')
        self.refresh_from_db()
