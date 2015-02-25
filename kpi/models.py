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
    ('survey_block', 'survey_block'),
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
    uid = models.CharField(max_length=8, default='')
    version_uid = models.CharField(max_length=5, default='')

    def asset_version_uid(self):
        return "%s@%s" % (self.uid, self.version_uid)

    def update_asset_type(self, ast):
        self.asset_type = ast
        self.save()

    class Meta:
        ordering = ('created',)

    def versions(self):
        return reversion.get_for_object(self)

    def get_revision(self, version_uid):
        return SurveyAssetRevision.objects.get(asset_uid=self.uid, version_uid=version_uid).revision
    def get_versions_for_revision(self, version_uid):
        return SurveyAssetRevision.objects.get(asset_uid=self.uid, version_uid=version_uid).get_versions()
    def get_version_data(self, version_uid):
        return self.get_versions_for_revision(version_uid)[0].field_dict

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()
    def _generate_uid(self):
        return ShortUUID().random(8)
    def _update_version_uid(self):
        self.version_uid = ShortUUID().random(5)
    def _generate_version_uid(self):
        return ShortUUID().random(5)

    def _extract_settings(self):
        if self.asset_type in ['survey_block']:
            try:
                body_content = json.loads(self.body)
            except ValueError, e:
                self.asset_type = 'text'

            if 'settings' in body_content:
                self.settings = json.dumps(body_content['settings'])
                del body_content['settings']
                self.body = json.dumps(body_content)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()

        # populate version_uid field if it's empty
        if self.version_uid == '':
            self._update_version_uid()

        self._extract_settings()

        self._update_version_uid()
        with transaction.atomic(), reversion.create_revision():
            reversion.add_meta(SurveyAssetRevision, asset_uid=self.uid, version_uid=self.version_uid)
            super(SurveyAsset, self).save(*args, **kwargs)

class SurveyAssetRevision(models.Model):
    asset_uid = models.CharField(max_length=20)
    version_uid = models.CharField(max_length=20)
    revision = models.ForeignKey(Revision, related_name='asset_version_uid')

    class Meta:
        index_together = [["asset_uid", "version_uid"],]

    def get_versions(self):
        return self.revision.version_set.all()

    @classmethod
    def get_asset_at_version(kls, asset_uid, version_uid):
        return kls.objects.get(asset_uid=asset_uid, version_uid=version_uid)

class Collection(models.Model):
    name = models.CharField(max_length=30)
    parent = models.ForeignKey('Collection', null=True, related_name='collections')
    owner = models.ForeignKey('auth.User', related_name='collections')
    uid = ShortUUIDField()
