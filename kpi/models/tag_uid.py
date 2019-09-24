# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.db import models
from taggit.models import Tag
from kpi.fields import KpiUidField


class TagUid(models.Model):
    tag = models.OneToOneField(Tag)
    uid = KpiUidField(uid_prefix='t')
