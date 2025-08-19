# coding: utf-8
from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel
from .instance import Instance


class Note(AbstractTimeStampedModel):
    note = models.TextField()
    instance = models.ForeignKey(Instance, related_name='notes', on_delete=models.CASCADE)

    class Meta:
        app_label = 'logger'
