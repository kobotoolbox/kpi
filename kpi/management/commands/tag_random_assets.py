# coding: utf-8
import random

from django.contrib.auth.models import Permission
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from kpi.models import Asset

# random words
TAGS = ' '.join(['whale various alien cat witness before cliff damp critic have now swallow',
                 'resource gown doctor blur lottery knock bright seminar laundry youth sample',
                 'make derive globe stage travel entry later fall nominee topple topic immense',
                 'myself style garment echo obvious index goat rally fox banner hawk clown alert',
                 'since blast']).split(' ')


def rand_tag():
    return random.choice(TAGS)


ten_users = random.sample(list(User.objects.all()), 10)


class Command(BaseCommand):
    def handle(self, *args, **options):
        def _rand_tags_list():
            num_tags = [3, 2, 2, 1, 1, 0, 0, 0][random.randint(0, 7)]
            return random.sample(TAGS, num_tags)

        def _rand_users():
            num_users = [3, 2, 2, 1, 1, 0, 0, 0][random.randint(0, 7)]
            return random.sample(ten_users, num_users)

        def _rand_perm():
            return random.choice(['view', 'change'])

        perms = {}

        def _pget(codename):
            return codename
            if codename not in perms:
                print(codename)
                perms[codename] = Permission.objects.get(codename=codename)
            return perms[codename]

        for sa in Asset.objects.all():
            _tags = _rand_tags_list()
            print('adding tags to asset: ' + repr(_tags))
            for tag in _tags:
                sa.tags.add(tag)
            for user in _rand_users():
                perm_code = _rand_perm()
                perm = _pget('%s_asset' % perm_code)
                print('assigning user permission "%s" -> %s' % (perm, user.username))
                sa.assign_perm(user, perm)
