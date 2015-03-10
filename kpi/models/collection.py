from django.db import models
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset

COLLECTION_UID_LENGTH = 22

class CollectionManager(models.Manager):
    def create(self, *args, **kwargs):
        assets = False
        if 'survey_assets' in kwargs:
            assets = kwargs['survey_assets']
            del kwargs['survey_assets']
        created = super(CollectionManager, self).create(*args, **kwargs)
        if assets:
            new_assets = []
            for asset in assets:
                asset['collection'] = created
                new_assets.append(SurveyAsset.objects.create(**asset))
            # bulk_create comes with a number of caveats
            # SurveyAsset.objects.bulk_create(new_assets)
        return created

class Collection(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('Collection', null=True, related_name='collections')
    owner = models.ForeignKey('auth.User', related_name='collections')
    uid = models.CharField(max_length=COLLECTION_UID_LENGTH, default='')
    objects = CollectionManager()

    def _generate_uid(self):
        return 'c' + ShortUUID().random(COLLECTION_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        if self.uid == '':
            self.uid = self._generate_uid()
        super(Collection, self).save(*args, **kwargs)
