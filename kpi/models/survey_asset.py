from django.db import models
from django.db import transaction
from shortuuid import ShortUUID
from jsonfield import JSONField
import reversion
import json
import copy
from role_types import ROLE_TYPES, get_role_privileges

SURVEY_ASSET_TYPES = [
    ('text', 'text'),
    ('survey_block', 'survey_block'),
    ('choice_list', 'choice list'),
]
SURVEY_ASSET_UID_LENGTH = 22

@reversion.register
class SurveyAsset(models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    additional_sheets = JSONField(null=True)
    settings = JSONField(null=True)
    asset_type = models.CharField(choices=SURVEY_ASSET_TYPES, max_length=20, default='text')
    collection = models.ForeignKey('Collection', related_name='survey_assets', null=True)
    owner = models.ForeignKey('auth.User', related_name='survey_assets', null=True)
    users = models.ManyToManyField('auth.User', through='SurveyAssetUser', related_name='+')
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=SURVEY_ASSET_UID_LENGTH, default='')

    class Meta:
        ordering = ('date_created',)

    def versions(self):
        return reversion.get_for_object(self)

    def versioned_data(self):
        return [v.field_dict for v in self.versions()]

    def _to_ss_structure(self, content_tag='survey'):
        # by default, the content is assigned to a 'sheet' with the asset_type
        # as a name
        obj = { self.asset_type: self.content }
 
        if self.additional_sheets:
            obj.update(copy.copy(self.additional_sheets))

        if self.settings:
            obj.update({'settings': [copy.copy(self.settings)]})

        return obj

    def to_ss_structure(self, content_tag='survey', strip_kuids=False):
        obj = {}
        rows = []
        for row in self.content:
            _r = copy.copy(row)
            if strip_kuids and 'kuid' in _r:
                del _r['kuid']
            rows.append(_r)
        obj[content_tag] = rows
        return obj

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def _generate_uid(self):
        return 'a' + ShortUUID().random(SURVEY_ASSET_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()
        with transaction.atomic(), reversion.create_revision():
            super(SurveyAsset, self).save(*args, **kwargs)

    def get_user_privileges(self, user):
        ''' Return the given user's permissions, either directly applied or
        inherited from a collection, as a tuple of (can_view, can_edit). '''
        if user is self.owner:
            return (True, True)
        try:
            sa_user = self.surveyassetuser_set.get(user=user)
            return get_role_privileges(sa_user.role_type)
        except SurveyAssetUser.DoesNotExist:
            pass
        if self.collection is None:
            return (False, False)
        else:
            return self.collection.get_user_privileges(user)

    def can_view(self, user):
        return self.get_user_privileges(user)[0]

    def can_edit(self, user):
        return self.get_user_privileges(user)[1]

    def can_delete(self, user):
        return user is self.owner

    def can_change_permissions(self, user):
        return user is self.owner or (
            self.can_edit(user) and self.editors_can_change_permissions)

    def get_all_user_privileges(self):
        ''' Return all inherited and directly-assigned privileges in the format
        {user_id: (can_view, can_edit)}. '''
        user_privileges = {}
        if self.collection is not None:
            user_privileges = self.collection.get_all_user_privileges()
        # Directly applied permissions override those inherited from a
        # collection.
        for sa_user in self.surveyassetuser_set.all():
            user_privileges[sa_user.id] = get_role_privileges(sa_user.role_type)
        # The owner has full access.
        user_privileges[self.owner_id] = (True, True)
        return user_privileges

class SurveyAssetUser(models.Model):
    survey_asset = models.ForeignKey(SurveyAsset)
    user = models.ForeignKey('auth.User')
    role_type = models.CharField(
        choices=ROLE_TYPES,
        max_length=20,
        default='denied'
    )
