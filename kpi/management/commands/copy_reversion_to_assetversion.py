import sys
import json
import random

from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.forms import model_to_dict
from raven.contrib.django.raven_compat.models import client
from reversion import revisions
from reversion.models import Version

from kpi.models import Asset, AssetVersion
from kpi.utils.kobo_to_xlsform import to_xlsform_structure

from django.contrib.auth.models import User


def _version_ids_grouped_by_deployed(asset):
    dvas = [v._static_version_id for v in asset._deployed_versioned_assets()]
    all_revs = revisions.get_for_object(asset).values_list('id', flat=True)
    undeployed = set(all_revs) - set(dvas)
    deployed = set(dvas)
    return (
        undeployed,
        deployed,
    )


def create_assetversion_for_revision__wrapped(asset, version, deployed):
    try:
        create_assetversion_for_revision(asset, version, deployed)
    except KeyboardInterrupt, e:
        sys.exit(0)
    except Exception, e:
        client.captureException()

def create_assetversion_for_revision(asset, version, deployed):
    fields = json.loads(version.serialized_data)[0].get('fields')
    params = {
        'name': fields.get('name'),
        '_reversion_version_id': version.id,
        'version_content': json.loads(fields.get('content', 'null')),
        'date_modified': fields.get('date_modified'),
        '_deployment_data': json.loads(fields.get('_deployment_data', 'false')),
        'deployed': deployed,
    }
    if deployed:
        _c = to_xlsform_structure(params['version_content'],
                                  deprecated_autoname=True)
        params['deployed_content'] = _c

    try:
        av = asset.asset_versions.get(_reversion_version_id=version.id)
        av.__dict__.update(params)
        av.save()
    except ObjectDoesNotExist, e:
        av = asset.asset_versions.create(**params)
    return av


def create_revisions_for_user(user):
    uavs = set()
    for asset in user.assets.all():
        new_avs = set()
        (undeployed, deployed) = _version_ids_grouped_by_deployed(asset)
        for v in Version.objects.filter(id__in=undeployed).all():
            new_avs = new_avs | set([create_assetversion_for_revision__wrapped(asset, v, deployed=False)])
        for v in Version.objects.filter(id__in=deployed).all():
            new_avs = new_avs | set([create_assetversion_for_revision__wrapped(asset, v, deployed=True)])
        uavs = uavs | new_avs
    return uavs


class Command(BaseCommand):
    def handle(self, *args, **options):
        _avs = set()
        for user in User.objects.all():
            sys.stdout.write('parsing {}: '.format(user.username))
            sys.stdout.flush()
            user_versions = create_revisions_for_user(user)
            print('{} versions'.format(len(user_versions)))
            _avs = _avs | user_versions
