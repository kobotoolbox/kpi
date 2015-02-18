from django.db import models
from django.db import transaction
from pygments.lexers import get_all_lexers, get_lexer_by_name
from pygments.styles import get_all_styles
from pygments.formatters.html import HtmlFormatter
from pygments import highlight
from shortuuidfield import ShortUUIDField
from shortuuid import ShortUUID
from jsonfield import JSONField
import reversion
from reversion.models import Revision
import json



SURVEY_ASSET_TYPES = [
    ('text', 'text'),
    ('survey', 'survey'),
    ('block', 'block'),
    ('choice_list', 'choice list'),
]

@reversion.register
class SurveyAsset(models.Model):
    title = models.CharField(max_length=100, blank=True, default='')
    created = models.DateTimeField(auto_now_add=True)
    body = models.TextField()
    settings = JSONField(null=True)
    asset_type = models.CharField(choices=SURVEY_ASSET_TYPES, max_length=20, default='text')
    collection = models.ForeignKey('Collection', related_name='survey_assets', null=True)
    owner = models.ForeignKey('auth.User', related_name='survey_assets', null=True)
    uid = models.CharField(max_length=8, default='')# lambda: ShortUUID().random(8), editable=False)
    revision_uid = models.CharField(max_length=5, default='')# lambda: ShortUUID().random(5))

    def update_asset_type(self, ast):
        self.asset_type = ast
        self.save()

    class Meta:
        ordering = ('created',)

    def versions(self):
        return reversion.get_for_object(self)

    def save(self, *args, **kwargs):
        """
        Use the `pygments` library to create a highlighted HTML
        representation of the code survey_asset.
        """
        if self.uid == '':
            self.uid = ShortUUID().random(8)

        self.revision_uid = ShortUUID().random(5)

        try:
            body_content = json.loads(self.body)

            if 'settings' in body_content:
                self.settings = body_content['settings']
                del body_content['settings']
                self.asset_type = 'survey'
            else:
                self.asset_type = 'block'
            self.body = json.dumps(body_content)
            self.revision_uid = ShortUUID().random(5)

        except ValueError, e:
            self.asset_type = 'text'

        with transaction.atomic(), reversion.create_revision():
            reversion.add_meta(SurveyAssetRevision, asset_uid=self.uid, version_uid=self.revision_uid)
            super(SurveyAsset, self).save(*args, **kwargs)

from reversion.models import Revision
class SurveyAssetRevision(models.Model):
    asset_uid = models.CharField(max_length=20)
    version_uid = models.CharField(max_length=20)
    revision = models.ForeignKey(Revision)

    class Meta:
        index_together = [["asset_uid", "version_uid"],]

    @classmethod
    def get_asset_at_version(kls, asset_uid, version_uid):
        kls.objects.get()

class Collection(models.Model):
    name = models.CharField(max_length=30)
    parent = models.ForeignKey('Collection', null=True, related_name='collections')
    owner = models.ForeignKey('auth.User', related_name='collections')
    uid = ShortUUIDField()
