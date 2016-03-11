from django.db import models
from taggit.models import Tag
from shortuuid import ShortUUID

TAG_UID_LENGTH = 22

class TagUid(models.Model):
    tag = models.OneToOneField(Tag)
    uid = models.CharField(max_length=TAG_UID_LENGTH, default='', unique=True)

    def _generate_uid(self):
        return 't' + ShortUUID().random(TAG_UID_LENGTH - 1)

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()
        super(TagUid, self).save(*args, **kwargs)
