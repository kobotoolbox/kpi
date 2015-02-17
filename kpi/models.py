from django.db import models
from pygments.lexers import get_all_lexers, get_lexer_by_name
from pygments.styles import get_all_styles
from pygments.formatters.html import HtmlFormatter
from pygments import highlight
from shortuuidfield import ShortUUIDField
from jsonfield import JSONField
import json



SURVEY_ASSET_TYPES = [
    ('text', 'text'),
    ('survey', 'survey'),
    ('block', 'block'),
    ('choice_list', 'choice list'),
]

class SurveyAsset(models.Model):
    title = models.CharField(max_length=100, blank=True, default='')
    created = models.DateTimeField(auto_now_add=True)
    body = models.TextField()
    settings = JSONField(null=True)
    asset_type = models.CharField(choices=SURVEY_ASSET_TYPES, max_length=20, default='text')
    collection = models.ForeignKey('Collection', related_name='survey_assets', null=True)
    owner = models.ForeignKey('auth.User', related_name='survey_assets', null=True)
    uuid = ShortUUIDField()

    class Meta:
        ordering = ('created',)

    def save(self, *args, **kwargs):
        """
        Use the `pygments` library to create a highlighted HTML
        representation of the code survey_asset.
        """
        try:
            body_content = json.loads(self.body)
            if 'settings' in body_content:
                self.settings = body_content['settings']
                del body_content['settings']
                self.asset_type = 'survey'
            else:
                self.asset_type = 'block'
            self.body = json.dumps(body_content)
        except ValueError, e:
            self.asset_type = 'text'
        super(SurveyAsset, self).save(*args, **kwargs)

class Collection(models.Model):
    name = models.CharField(max_length=30)
    parent = models.ForeignKey('Collection', null=True, related_name='collections')
    owner = models.ForeignKey('auth.User', related_name='collections')
    uuid = ShortUUIDField()
