# coding: utf-8
from django.db import models
from taggit.models import Tag
from kpi.fields import KpiUidField


class TagUid(models.Model):
    tag = models.OneToOneField(Tag, on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='t')
