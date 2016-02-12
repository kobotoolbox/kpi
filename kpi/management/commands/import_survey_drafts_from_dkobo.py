from StringIO import StringIO
from optparse import make_option
from pyxform.xls2json_backends import csv_to_dict
import logging
import re

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import models
from jsonfield import JSONField
from taggit.managers import TaggableManager

from kpi.models import Asset
from kpi.models import Collection
from kpi.models.asset import KpiTaggableManager, ASSET_UID_LENGTH


class SurveyDraft(models.Model):
    '''
    SurveyDrafts belong to a user and contain the minimal representation of
    the draft survey of the user and of the question library.
    '''
    class Meta:
        app_label = 'koboform'

    user = models.ForeignKey(User, related_name="survey_drafts")
    name = models.CharField(max_length=255, null=False)
    body = models.TextField()
    description = models.CharField(max_length=255, null=True)
    date_created = models.DateTimeField()
    date_modified = models.DateTimeField()
    summary = JSONField()
    asset_type = models.CharField(max_length=32, null=True)
    tags = TaggableManager(manager=KpiTaggableManager)
    kpi_asset_uid = models.CharField(
        max_length=ASSET_UID_LENGTH, default='', blank=True)


def _csv_to_dict(content):
    out_dict = {}
    for (key, sheet) in csv_to_dict(StringIO(content.encode('utf-8'))).items():
        if not re.search(r'_header$', key):
            out_dict[key] = sheet
    return out_dict


def _set_auto_field_update(kls, field_name, val):
    field = filter(lambda f: f.name == field_name, kls._meta.fields)[0]
    field.auto_now = val
    field.auto_now_add = val


def _import_user_assets(from_user, to_user):
    user = to_user

    # now, if a user wants to re-import, they can delete the asset from kpi
    # and re-run management command
    already_migrated_sds = user.survey_drafts.exclude(kpi_asset_uid='')
    for migrated_sd in already_migrated_sds.all():
        _kpi_uid = migrated_sd.kpi_asset_uid
        if Asset.objects.filter(uid=_kpi_uid).count() == 0:
            migrated_sd.kpi_asset_uid = ''
            migrated_sd.save()

    not_already_migrated = user.survey_drafts.filter(kpi_asset_uid='')
    user_survey_drafts = not_already_migrated.filter(asset_type=None)
    user_qlib_assets = not_already_migrated.exclude(asset_type=None)

    def _import_asset(asset, parent_collection=None, asset_type='survey'):
        survey_dict = _csv_to_dict(asset.body)
        obj = {
            'name': asset.name,
            'date_created': asset.date_created,
            'date_modified': asset.date_modified,
            'asset_type': asset_type,
            'owner': user,
        }

        if parent_collection is not None:
            obj['parent'] = parent_collection
            del obj['name']
        new_asset = Asset(**obj)

        _set_auto_field_update(Asset, "date_created", False)
        _set_auto_field_update(Asset, "date_modified", False)
        new_asset.content = survey_dict
        new_asset.date_created = obj['date_created']
        new_asset.date_modified = obj['date_modified']
        new_asset.save()
        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)

        # Note on the old draft the uid of the new asset
        asset.kpi_asset_uid = new_asset.uid
        asset.save()

        return new_asset

    for survey_draft in user_survey_drafts.all():
        try:
            new_asset = _import_asset(survey_draft, asset_type='survey')
        except:
            message = (u'Failed to migrate survey draft with name="{}" '
                       u'and pk={}').format(survey_draft.name, survey_draft.pk)
            logging.error(message, exc_info=True)

    (qlib, _) = Collection.objects.get_or_create(name="question library",
                                                 owner=user)

    for qlib_asset in user_qlib_assets.all():
        try:
            new_asset = _import_asset(qlib_asset, qlib, asset_type='block')
        except:
            message = (u'Failed to migrate library asset with name="{}" '
                       u'and pk={}').format(survey_draft.name, survey_draft.pk)
            logging.error(message, exc_info=True)

    _set_auto_field_update(Asset, "date_created", False)
    _set_auto_field_update(Asset, "date_modified", False)
    qlib.date_created = user.date_joined
    qlib.date_modified = user.date_joined
    qlib.save()
    _set_auto_field_update(Asset, "date_created", True)
    _set_auto_field_update(Asset, "date_modified", True)


class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--destroy',
                    action='store_true',
                    dest='destroy',
                    default=False,
                    help='Delete all collections, assets, and tasks for user'),
        make_option('--destination',
                    action='store',
                    dest='destination',
                    default=False,
                    help='A uid of a destination collection that will contain '
                    'the imported asset(s)'
                    ),
        make_option('--allusers',
                    action='store_true',
                    dest='all_users',
                    default=False,
                    help='migrate all the users at once'),
        make_option('--username',
                    action='store',
                    dest='username',
                    default=False,
                    help='specify the user to migrate'),
        make_option('--to-username',
                    action='store',
                    dest='to_username',
                    default=False,
                    help='specify the user to migrate the assets TO (default: '
                    'same as --username)'),
        make_option('--quiet',
                    action='store_true',
                    dest='quiet',
                    default=False,
                    help='Do not output status messages'),
    )

    def handle(self, *args, **options):
        if options.get('quiet'):
            # Do not output anything
            def print_str(string): pass
        else:
            # Output status messages
            def print_str(string): print string

        users = User.objects.none()
        to_user = False
        if options.get('all_users'):
            users = User.objects.all()
        else:
            if options.get('username'):
                users = [User.objects.get(username=options.get('username'))]
            else:
                raise Exception('must specify either --username=username '
                                'or --allusers')
            if options.get('to_username'):
                to_user = User.objects.get(username=options.get('to_username'))

        for from_user in users:
            if not to_user:
                to_user = from_user

            print_str(
                "user has %d collections" % to_user.owned_collections.count())
            print_str("user has %d assets" % to_user.assets.count())
            if options.get('destroy'):
                print_str("Destroying user's collections and assets in KPI.")
                to_user.owned_collections.all().delete()
                to_user.assets.all().delete()
                print_str("Removing references in dkobo to KPI assets.")
                to_user.survey_drafts.update(kpi_asset_uid='')
            print_str("Importing assets and collections.")
            print_str(
                "user has %d collections" % to_user.owned_collections.count())
            print_str("user has %d assets" % to_user.assets.count())
            _import_user_assets(from_user, to_user)
