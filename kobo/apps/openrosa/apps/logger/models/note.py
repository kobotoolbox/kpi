# coding: utf-8
from django.db import models
from .instance import Instance


class Note(models.Model):
    note = models.TextField()
    instance = models.ForeignKey(Instance, related_name='notes', on_delete=models.CASCADE)
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'logger'
