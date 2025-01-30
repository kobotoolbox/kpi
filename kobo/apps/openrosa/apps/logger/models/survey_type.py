# coding: utf-8
from django.db import models


class SurveyType(models.Model):
    slug = models.CharField(max_length=100, unique=True)

    class Meta:
        app_label = 'logger'

    def __str__(self):
        return "SurveyType: %s" % self.slug
