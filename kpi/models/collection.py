from django.db import models
from shortuuidfield import ShortUUIDField
from shortuuid import ShortUUID

class Collection(models.Model):
    name = models.CharField(max_length=30)
    parent = models.ForeignKey('Collection', null=True, related_name='collections')
    owner = models.ForeignKey('auth.User', related_name='collections')
    uid = ShortUUIDField()
