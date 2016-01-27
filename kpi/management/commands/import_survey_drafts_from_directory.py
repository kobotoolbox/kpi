from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.contrib.auth.models import User
from django.conf import settings
from django.forms.models import model_to_dict
import os
import json
import glob
import random
# from django.utils import timezone
from django.contrib.sites.models import Site
import dateutil.parser

import ipdb

import re

from kpi.models import Collection
from kpi.models import Asset

from pyxform.xls2json_backends import csv_to_dict
from StringIO import StringIO

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

def _import_user_drafts(server, username, draft_id, fpath):
    try:
        owner = User.objects.get(username=username)
    except User.DoesNotExist, e:
        owner = User.objects.create(username=username, password='password', email='%s@kobo.org' % username)
        owner.set_password('password')
        owner.save()

    (collection, created) = Collection.objects.get_or_create(name="%s's drafts" % (username,), owner=owner)

    sd = {}
    with open(fpath, 'rb') as ff:
        sd = json.loads(ff.read())

    obj = {
        'name': '%s' % (sd['name']),
        'date_created': dateutil.parser.parse(sd['date_created']),
        'date_modified': dateutil.parser.parse(sd['date_modified']),
    }


    _set_auto_field_update(Asset, "date_created", True)
    _set_auto_field_update(Asset, "date_modified", True)
    (asset, sa_created) = collection.assets.get_or_create(name=obj['name'], owner=owner)

    collection.tags = "server-%s" % server
    survey_dict = _csv_to_dict(sd['body'])
    asset.content = survey_dict

    asset.date_created = obj['date_created']
    asset.date_modified = obj['date_modified']

    _set_auto_field_update(Asset, "date_created", False)
    _set_auto_field_update(Asset, "date_modified", False)
    asset.save()

class Command(BaseCommand):
    def handle(self, *args, **options):
        dirname = args[0]
        directory = os.path.join(settings.BASE_DIR, dirname)
        if not os.path.exists(directory):
            raise Exception("directory doesnt exist")

        Asset.objects.all().delete()
        Collection.objects.all().delete()

        n = 0
        maxn = 300000
        for fpath in glob.glob(os.path.join(directory, '*.json')):
            if random.randint(0, 10) != 10:
                continue
            n+=1
            if n > maxn:
                return
            fname = fpath.replace(directory+'/', '')
            pattern = r'^(\S+)\.(\w+)\.(\d+)\.json$'
            (server, username, draft_id) = re.match(pattern, fname).groups()
            _import_user_drafts(server, username, draft_id, fpath)

        call_command('tag_random_assets')
