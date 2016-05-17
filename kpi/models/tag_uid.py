from django.db import models
from taggit.models import Tag
from ..fields import KpiUidField

class TagUid(models.Model):
    tag = models.OneToOneField(Tag)
    uid = KpiUidField(uid_prefix='t')
