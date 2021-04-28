# coding: utf-8
from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import JSONField

class HubExtrauserdetail(models.Model):
    data = JSONField(null=True)
    # data = models.TextField()
    user = models.ForeignKey(User, models.DO_NOTHING, unique=True)

    class Meta:
        managed = False
        db_table = 'hub_extrauserdetail'